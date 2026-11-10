import java.net.URI;
import java.net.ServerSocket;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.Duration;
import java.util.*;
import com.fasterxml.jackson.databind.*;

/** 明示的に実行するTiDB実機検証。接続設定にある既存アプリのスキーマでは実行しない。 */
public class TidbSessionVerification {
    static final ObjectMapper JSON = new ObjectMapper();
    static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    static int checks;
    static Connection db;
    static final List<Process> processes = new ArrayList<>();
    static final List<Path> logs = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        String schema = System.getenv("VERIFY_SCHEMA");
        if (schema == null || !schema.matches("chron151_verify_[0-9a-f]{12}"))
            throw new IllegalArgumentException("Invalid disposable schema name");
        String url = System.getenv("DB_URL");
        if (url == null || !url.contains("sslMode=VERIFY_IDENTITY"))
            throw new IllegalArgumentException("Verified TLS JDBC URL required");
        try (Connection connection = DriverManager.getConnection(url,
                System.getenv("DB_USERNAME"), System.getenv("DB_PASSWORD"))) {
            db = connection;
            if (args[0].equals("prepare")) {
                check(!schema.equals(db.getCatalog()), "Original database differs from disposable database");
                check(number("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?", schema) == 0,
                        "Disposable database does not exist");
                try (Statement s = db.createStatement()) { s.executeUpdate("CREATE DATABASE `" + schema + "`"); }
                System.out.println("DisposableDatabaseCreated=true");
            } else if (args[0].equals("drop")) {
                check(!schema.equals(db.getCatalog()), "Cleanup uses original connection");
                try (Statement s = db.createStatement()) { s.executeUpdate("DROP DATABASE `" + schema + "`"); }
                System.out.println("DisposableDatabaseRemoved=true");
            } else {
                check(schema.equals(db.getCatalog()), "Verification uses disposable database");
                verify();
                System.out.println("TiDBSessionChecksPassed=true Checks=" + checks);
            }
        } catch (SQLException e) {
            // 例外メッセージには接続先の識別情報が含まれ得るため、出力しない。
            throw new IllegalStateException("TiDB SQL failure: state=" + e.getSQLState() + " code=" + e.getErrorCode());
        } finally {
            for (Process p : processes) stop(p);
            for (Path log : logs) Files.deleteIfExists(log);
        }
    }

    static void verify() throws Exception {
        check(number("SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1") == 2, "V1 and V2 applied");
        check(number("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='SPRING_SESSION' AND index_name IN ('SPRING_SESSION_IX1','SPRING_SESSION_IX2','SPRING_SESSION_IX3')") == 3,
                "Session indexes exist");
        try (Statement s = db.createStatement(); ResultSet r = s.executeQuery("SHOW SESSION STATUS LIKE 'Ssl_cipher'")) {
            check(r.next() && !r.getString(2).isBlank(), "JDBC transport is encrypted");
        }
        int a = port(), b = port();
        Process first = start(a), second = start(b);
        Client browser = new Client();
        check(browser.call(a, "GET", "/api/todolist/getAll", null, null).statusCode() == 401, "Anonymous API denied");
        String preLogin = browser.token(a);
        String credentials = "{\"loginId\":\"chron151verify\",\"password\":\"Session151Check!\"}";
        check(browser.call(a, "POST", "/api/signup", preLogin, credentials).statusCode() == 200, "Signup");
        check(browser.call(a, "POST", "/api/login", preLogin, credentials).statusCode() == 200, "Login A");
        String sessionId = new String(Base64.getDecoder().decode(browser.cookie.split("=",2)[1]), StandardCharsets.UTF_8);
        check(number("SELECT COUNT(*) FROM SPRING_SESSION WHERE SESSION_ID=? AND PRINCIPAL_NAME=?", sessionId, "chron151verify") == 1,
                "Authentication session persisted");
        long loginAccess = number("SELECT LAST_ACCESS_TIME FROM SPRING_SESSION WHERE SESSION_ID=?", sessionId);
        String token = browser.token(a);
        check(number("SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES WHERE SESSION_PRIMARY_ID IN (SELECT PRIMARY_ID FROM SPRING_SESSION WHERE SESSION_ID=?)", sessionId) >= 2,
                "SecurityContext and CSRF stored");
        check(browser.call(b, "GET", "/api/todolist/getAll", null, null).statusCode() == 200, "B restores A authentication");
        check(number("SELECT COUNT(*) FROM SPRING_SESSION WHERE SESSION_ID=? AND LAST_ACCESS_TIME>? AND MAX_INACTIVE_INTERVAL=604800 AND EXPIRY_TIME=LAST_ACCESS_TIME+604800000",sessionId,loginAccess)==1,
                "B refreshes persisted seven-day idle expiry");
        check(browser.call(b, "POST", "/api/todolist/register", preLogin, task()).statusCode() == 403, "Old CSRF rejected by B");
        check(browser.call(b, "POST", "/api/todolist/register", null, task()).statusCode() == 403, "Missing CSRF rejected by B");
        var created = browser.call(b, "POST", "/api/todolist/register", token, task());
        check(created.statusCode() == 200, "B restores A CSRF and creates task");
        long id = JSON.readTree(created.body()).asLong();
        check(id > 0, "Created task id");
        check(browser.call(a, "PUT", "/api/todolist/update/status", token, "{\"id\":"+id+",\"isCompleted\":true}").statusCode() == 204,
                "A accepts shared CSRF and updates");
        stop(first);
        first = start(a);
        var restored = browser.call(a, "GET", "/api/todolist/getAll", null, null);
        check(restored.statusCode() == 200 && JSON.readTree(restored.body()).get(0).get("isCompleted").asBoolean(),
                "Fresh JVM restores session and data");
        check(browser.call(a, "DELETE", "/api/todolist/delete", token, "{\"id\":"+id+"}").statusCode() == 204,
                "Fresh JVM accepts pre-restart CSRF");
        String savedCookie = browser.cookie;
        var logout = browser.call(a, "POST", "/api/logout", token, null);
        check(logout.statusCode() == 200 && logout.headers().allValues("set-cookie").stream().anyMatch(v -> v.contains("Max-Age=0")),
                "Logout removes cookie");
        check(number("SELECT COUNT(*) FROM SPRING_SESSION WHERE SESSION_ID=?", sessionId) == 0, "Logout removes persisted session");
        browser.cookie = savedCookie;
        check(browser.call(b, "GET", "/api/todolist/getAll", null, null).statusCode() == 401, "B rejects logged-out cookie");
        // 再ログインし、定期削除を停止した状態で今回の検証用セッションだけを期限切れにする。
        browser.cookie = null;
        String next = browser.token(a);
        check(browser.call(a, "POST", "/api/login", next, credentials).statusCode() == 200, "Second login");
        token = browser.token(a);
        sessionId = new String(Base64.getDecoder().decode(browser.cookie.split("=",2)[1]), StandardCharsets.UTF_8);
        long past = System.currentTimeMillis() - 60_000;
        try (PreparedStatement s = db.prepareStatement("UPDATE SPRING_SESSION SET LAST_ACCESS_TIME=?, MAX_INACTIVE_INTERVAL=1, EXPIRY_TIME=? WHERE SESSION_ID=?")) {
            s.setLong(1,past); s.setLong(2,past+1000); s.setString(3,sessionId);
            check(s.executeUpdate() == 1, "Expire test session");
        }
        check(number("SELECT COUNT(*) FROM SPRING_SESSION WHERE SESSION_ID=?",sessionId)==1, "Expired data remains before access");
        var expired = browser.call(b,"GET","/api/todolist/getAll",null,null);
        check(expired.statusCode()==401, "Expired persisted session rejected");
        check(expired.headers().allValues("set-cookie").stream().noneMatch(v->v.contains("Max-Age=604800")), "Expired cookie not extended");
        check(browser.call(a,"POST","/api/todolist/register",token,task()).statusCode()==401, "Expired CSRF cannot restore login");
        check(number("SELECT COUNT(*) FROM SPRING_SESSION WHERE SESSION_ID=? AND EXPIRY_TIME>?",sessionId,System.currentTimeMillis())==0,
                "Expired session not renewed");
        // 保存した2件の検証用セッションに対し、実際のリポジトリ実装で期限切れ削除を行う。
        var source = new org.springframework.jdbc.datasource.DriverManagerDataSource(
                System.getenv("DB_URL"), System.getenv("DB_USERNAME"), System.getenv("DB_PASSWORD"));
        var jdbc = new org.springframework.jdbc.core.JdbcTemplate(source);
        var manager = new org.springframework.jdbc.datasource.DataSourceTransactionManager(source);
        var repo = new org.springframework.session.jdbc.JdbcIndexedSessionRepository(jdbc,
                new org.springframework.transaction.support.TransactionTemplate(manager));
        @SuppressWarnings("unchecked")
        var sessions = (org.springframework.session.SessionRepository<org.springframework.session.Session>)(Object)repo;
        var dead = sessions.createSession(); dead.setAttribute("verification", "expired"); sessions.save(dead);
        var live = sessions.createSession(); live.setAttribute("verification", "active"); sessions.save(live);
        jdbc.update("UPDATE SPRING_SESSION SET LAST_ACCESS_TIME=?,MAX_INACTIVE_INTERVAL=1,EXPIRY_TIME=? WHERE SESSION_ID=?",past,past+1000,dead.getId());
        String deadPrimary = jdbc.queryForObject("SELECT PRIMARY_ID FROM SPRING_SESSION WHERE SESSION_ID=?",String.class,dead.getId());
        check(number("SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES WHERE SESSION_PRIMARY_ID=?",deadPrimary)==1,"Expired attribute exists before cleanup");
        repo.cleanUpExpiredSessions();
        check(number("SELECT COUNT(*) FROM SPRING_SESSION WHERE SESSION_ID=?",dead.getId())==0,"Cleanup removes expired session");
        check(number("SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES WHERE SESSION_PRIMARY_ID=?",deadPrimary)==0,"TiDB cascades attribute deletion");
        check("active".equals(sessions.findById(live.getId()).getAttribute("verification")),"Cleanup preserves active session");
        sessions.deleteById(live.getId());
        check(sessions.findById(live.getId())==null,"Repository explicit delete");
    }

    static String task() { return "{\"title\":\"TiDB session verification\",\"priority\":\"MIDDLE\",\"dueKind\":\"NONE\"}"; }
    static int port() throws Exception { try(ServerSocket s = new ServerSocket(0)) { return s.getLocalPort(); } }
    static Process start(int port) throws Exception {
        Path log = Files.createTempFile("chron151-jvm-", ".log"); logs.add(log);
        var builder = new ProcessBuilder("java", "-cp", System.getProperty("java.class.path"),
                "com.magu1436.chronolist.Application", "--server.port="+port,
                "--server.address=127.0.0.1", "--spring.profiles.active=prod",
                "--spring.session.jdbc.cleanup-cron=-", "--logging.level.root=ERROR",
                "--logging.level.org.mybatis=ERROR", "--logging.level.org.mybatis.spring=ERROR");
        builder.redirectErrorStream(true).redirectOutput(log.toFile());
        Process p = builder.start(); processes.add(p);
        for (int attempt=0; attempt<120; attempt++) {
            if (!p.isAlive()) throw new IllegalStateException("Backend JVM exited; logs withheld to protect connection details");
            try { if (new Client().call(port,"GET","/api/todolist/getAll",null,null).statusCode()==401) return p; }
            catch (Exception ignored) { }
            Thread.sleep(1000);
        }
        throw new IllegalStateException("Backend startup timed out");
    }
    static void stop(Process p) throws InterruptedException {
        if (p.isAlive()) { p.destroy(); if(!p.waitFor(15,java.util.concurrent.TimeUnit.SECONDS)) { p.destroyForcibly(); p.waitFor(); } }
    }
    static long number(String sql, Object... parameters) throws SQLException {
        try(PreparedStatement s=db.prepareStatement(sql)) {
            for(int i=0;i<parameters.length;i++) s.setObject(i+1,parameters[i]);
            try(ResultSet r=s.executeQuery()) { r.next(); return r.getLong(1); }
        }
    }
    static void check(boolean condition, String label) {
        if(!condition) throw new IllegalStateException(label);
        checks++; System.out.println("PASS " + label);
    }
    static class Client {
        String cookie;
        HttpResponse<String> call(int port,String method,String path,String token,String body) throws Exception {
            var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(20));
            if(cookie!=null) request.header("Cookie",cookie);
            if(token!=null) request.header("X-CSRF-TOKEN",token);
            if(body!=null) request.header("Content-Type","application/json");
            var response=HTTP.send(request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
            for(String value:response.headers().allValues("set-cookie")) if(value.startsWith("JSESSIONID=")) cookie=value.split(";",2)[0];
            return response;
        }
        String token(int port) throws Exception {
            var response=call(port,"GET","/api/csrf",null,null);
            check(response.statusCode()==200,"CSRF token acquired");
            return JSON.readTree(response.body()).get("token").asText();
        }
    }
}
