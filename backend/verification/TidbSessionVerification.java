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
    static final String DATE = "2026-11-02";
    static final String NEXT_DATE = "2026-11-03";
    static final String SCHEDULER = "/api/scheduler/";
    static final String TIMEBLOCKING = "/api/timeblocking/";
    static int checks;
    static Connection db;
    static final List<Process> processes = new ArrayList<>();
    static final List<Path> logs = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !Set.of("prepare", "empty", "verify", "drop").contains(args[0]))
            throw new IllegalArgumentException("検証モードを指定してください");
        String schema = System.getenv("VERIFY_SCHEMA");
        if (schema == null || !schema.matches("chron151_verify_[0-9a-f]{12}"))
            throw new IllegalArgumentException("Invalid disposable schema name");
        String url = System.getenv("DB_URL");
        if (url == null || !url.matches("jdbc:mysql://[^/@?]+/[^/?]+\\?(?:[^&]+&)*sslMode=VERIFY_IDENTITY(?:&[^&]+)*"))
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
                if (args[0].equals("empty")) {
                    check(number("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()") == 0,
                            "マイグレーション前の検証用DBが空");
                } else {
                    verify();
                    System.out.println("TiDBSessionChecksPassed=true Checks=" + checks);
                }
            }
        } catch (SQLException e) {
            // 例外メッセージには接続先の識別情報が含まれ得るため、出力しない。
            System.out.println("FAIL TiDBのSQL実行 (code=" + e.getErrorCode() + ")");
            throw new IllegalStateException("TiDB SQL failure");
        } finally {
            for (Process p : processes) stop(p);
            for (Path log : logs) Files.deleteIfExists(log);
        }
    }

    static void verify() throws Exception {
        verifySchema();
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
        verifySchedulerAndTimeBlocking(a, b, browser, token);
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

    static void verifySchema() throws SQLException {
        check(rows("""
                SELECT installed_rank, version, IF(success, 1, 0)
                FROM flyway_schema_history ORDER BY installed_rank
                """).equals(List.of(List.of("1", "1", "1"), List.of("2", "2", "1"),
                        List.of("3", "3", "1"), List.of("4", "4", "1"))),
                "Flyway履歴は順にV1・V2・V3・V4の成功4件");
        check(number("SELECT @@foreign_key_checks = 1 AND @@tidb_enable_check_constraint = 1") == 1,
                "外部キーとCHECK制約が有効");
        check(number("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'time_blocks' AND column_name = 'schedule_id'
                """) == 0, "time_blocks.schedule_id列が存在しない");
        check(number("""
                SELECT COUNT(*) FROM information_schema.key_column_usage
                WHERE table_schema = DATABASE() AND table_name = 'time_blocks'
                  AND (constraint_name = 'fk_3' OR column_name = 'schedule_id' OR referenced_table_name = 'schedule')
                """) == 0, "time_blocksからscheduleへの外部キーが存在しない");
        check(number("""
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = 'time_blocks'
                  AND (index_name = 'fk_3' OR column_name = 'schedule_id')
                """) == 0, "time_blocksの旧予定参照用索引が存在しない");
        check(number("""
                SELECT COUNT(*) FROM information_schema.key_column_usage
                WHERE table_schema = DATABASE() AND table_name = 'calendar_event' AND column_name = 'schedule_id'
                  AND referenced_table_schema = DATABASE() AND referenced_table_name = 'schedule'
                  AND referenced_column_name = 'id'
                """) == 1, "calendar_eventからscheduleへの外部キーが残っている");
        check(number("SELECT COUNT(*) FROM schedule") == 0, "無効な外部キーの検証前に予定が存在しない");
        try (Statement statement = db.createStatement()) {
            statement.executeUpdate("INSERT INTO calendar_event (schedule_id, color) VALUES (1, '#123456')");
            throw new IllegalStateException("存在しない予定IDを参照するイベントが登録された");
        } catch (SQLException e) {
            if (e.getErrorCode() != 1452) throw e;
            check(number("SELECT COUNT(*) FROM calendar_event") == 0, "存在しない予定IDへの外部キーを拒否 (1452)");
        }
    }

    static void verifySchedulerAndTimeBlocking(int a, int b, Client owner, String ownerToken) throws Exception {
        Client other = new Client();
        String otherToken = signupAndLogin(other, b, "chron190other");
        long ownerTable = createdId(owner, a, "POST", TIMEBLOCKING + "timeTable/createAt", ownerToken,
                Map.of("date", DATE), "所有者のタイムテーブル登録");
        long otherTable = createdId(other, b, "POST", TIMEBLOCKING + "timeTable/createAt", otherToken,
                Map.of("date", DATE), "別ユーザーの同日タイムテーブル登録");
        var originalBlock = blockBody(ownerTable, "所有者のブロック");
        long ownerBlock = createdId(owner, a, "PUT", TIMEBLOCKING + "timeBlock/register", ownerToken,
                originalBlock, "所有者のブロック登録");
        long ownerTask = createdId(owner, a, "PUT", TIMEBLOCKING + "timeBlockTask/register", ownerToken,
                Map.of("timeBlockId", ownerBlock, "title", "保持するタスク"), "ブロックの子タスク登録");
        var initialTimeBlocking = timeBlockingRows();

        var timedEvent = Map.of("kind", "DATED", "startAt", DATE + "T09:15:00", "endAt", DATE + "T10:45:00",
                "title", "同日の通常予定", "color", "#123456", "memo", "通常予定のメモ");
        long ownerEvent = createdId(owner, b, "POST", SCHEDULER + "register", ownerToken,
                timedEvent, "通常予定を別JVM経由で登録");
        long otherEvent = createdId(other, a, "POST", SCHEDULER + "register", otherToken,
                timedEvent, "別ユーザーの同日予定登録");
        check(timeBlockingRows().equals(initialTimeBlocking), "予定の登録でタイムテーブル・ブロック・タスクが維持される");

        var initialCalendar = calendarRows();
        long otherBlock = createdId(other, a, "PUT", TIMEBLOCKING + "timeBlock/register", otherToken,
                blockBody(otherTable, "別ユーザーのブロック"), "既存の予定がある日のブロック登録");
        long otherTask = createdId(other, a, "PUT", TIMEBLOCKING + "timeBlockTask/register", otherToken,
                Map.of("timeBlockId", otherBlock, "title", "連動して削除するタスク"), "削除対象の子タスク登録");
        check(calendarRows().equals(initialCalendar), "ブロックとタスクの登録で予定とイベントが維持される");

        check(onlyItem(events(owner, b), ownerEvent) && onlyItem(events(other, a), otherEvent),
                "同日の予定一覧に各ユーザー自身のイベントだけが表示される");
        var ownerTimeTable = timeTable(owner, b);
        var otherTimeTable = timeTable(other, a);
        check(ownerTimeTable.path("id").asLong() == ownerTable && otherTimeTable.path("id").asLong() == otherTable
                && onlyItem(ownerTimeTable.path("timeBlocks"), ownerBlock)
                && onlyItem(otherTimeTable.path("timeBlocks"), otherBlock), "同日のタイムテーブルとブロックが所有者ごとに分離される");

        var allDayEvent = Map.of("id", ownerEvent, "kind", "ALL_DAY", "startDate", DATE, "endDate", NEXT_DATE,
                "title", "同日の終日予定", "color", "#654321", "memo", "終日予定のメモ");
        var updatedBlock = blockBody(ownerTable, "変更後のブロック");
        updatedBlock.put("id", ownerBlock);
        var updatedStart = Map.of("id", ownerBlock, "startAt", "16:00:00");
        var deleteBlock = Map.of("id", ownerBlock);
        var beforeForeignMutations = timeBlockingRows();
        expectStatus(other, b, "PUT", SCHEDULER + "update", otherToken, allDayEvent, 404, "他人の予定更新を拒否");
        expectStatus(other, b, "DELETE", SCHEDULER + "delete/" + ownerEvent, otherToken, null, 404, "他人の予定削除を拒否");
        expectStatus(other, b, "PUT", TIMEBLOCKING + "timeBlock/update", otherToken, updatedBlock, 404, "他人のブロック更新を拒否");
        expectStatus(other, b, "PUT", TIMEBLOCKING + "timeBlock/update/startAt", otherToken, updatedStart, 404, "他人のブロック開始時刻更新を拒否");
        expectStatus(other, b, "DELETE", TIMEBLOCKING + "timeBlock/delete", otherToken, deleteBlock, 404, "他人のブロック削除を拒否");
        expectStatus(other, b, "PUT", TIMEBLOCKING + "timeBlock/register", otherToken, originalBlock, 404, "他人のタイムテーブルへの配置を拒否");
        check(calendarRows().equals(initialCalendar) && timeBlockingRows().equals(beforeForeignMutations),
                "他人のデータへの操作を拒否した後も全業務行が維持される");

        expectStatus(owner, a, "PUT", TIMEBLOCKING + "timeBlock/update", ownerToken, updatedBlock, 204, "所有者のブロック更新");
        check(calendarRows().equals(initialCalendar), "ブロックの更新で予定とイベントが維持される");
        expectStatus(owner, b, "PUT", TIMEBLOCKING + "timeBlock/update/startAt", ownerToken, updatedStart, 204, "所有者のブロック開始時刻更新");
        var changedBlock = timeTable(owner, a).path("timeBlocks").path(0);
        check(changedBlock.path("id").asLong() == ownerBlock && "変更後のブロック".equals(changedBlock.path("title").asText())
                && changedBlock.path("startAt").asText().matches("16:00(?::00)?")
                && onlyItem(changedBlock.path("tasks"), ownerTask),
                "開始時刻とブロックの更新が反映され、子タスクが取得できる");
        check(calendarRows().equals(initialCalendar), "ブロックの開始時刻更新で予定とイベントが維持される");
        expectStatus(other, b, "DELETE", TIMEBLOCKING + "timeBlock/delete", otherToken, Map.of("id", otherBlock), 204,
                "同日に予定があるブロックを削除");
        var remainingBlocks = timeTable(other, a).path("timeBlocks");
        check(remainingBlocks.isArray() && remainingBlocks.isEmpty()
                && number("SELECT COUNT(*) FROM time_block_tasks WHERE id = ?", otherTask) == 0,
                "削除したブロックが一覧から消え、子タスクが連動して削除される");
        check(calendarRows().equals(initialCalendar), "ブロックの削除で予定とイベントが維持される");

        var survivingTimeBlocking = timeBlockingRows();
        expectStatus(owner, b, "PUT", SCHEDULER + "update", ownerToken, allDayEvent, 204, "同日の通常予定を終日予定に更新");
        var updatedEvents = events(owner, a);
        check(onlyItem(updatedEvents, ownerEvent) && "ALL_DAY".equals(updatedEvents.path(0).path("kind").asText())
                && DATE.equals(updatedEvents.path(0).path("startDate").asText())
                && NEXT_DATE.equals(updatedEvents.path(0).path("endDate").asText()), "終日への更新が取得結果に反映される");
        var endDateEvents = JSON.readTree(expectStatus(owner, a, "GET", SCHEDULER + "getEvents/" + NEXT_DATE + "/" + NEXT_DATE,
                null, null, 200, "終日予定の終了日を取得").body());
        check(endDateEvents.isArray() && endDateEvents.isEmpty(), "排他的な終了日の一覧には終日予定が含まれない");
        check(timeBlockingRows().equals(survivingTimeBlocking), "終日への更新でブロック・子タスクが維持される");
        long scheduleId = number("SELECT schedule_id FROM calendar_event WHERE id = ?", ownerEvent);
        var beforeInvalidRange = calendarRows();
        try (var statement = db.prepareStatement("UPDATE schedule SET end_date = start_date WHERE id = ?")) {
            statement.setLong(1, scheduleId);
            try {
                statement.executeUpdate();
                throw new AssertionError("V4のCHECK制約が空の終日予定を許可した");
            } catch (SQLException e) {
                check(e.getMessage().contains("chk_all_day_nonempty"), "V4のCHECK制約が空の終日予定を拒否する");
            }
        }
        check(calendarRows().equals(beforeInvalidRange), "空の終日予定の拒否後も予定とイベントが維持される");
        expectStatus(owner, a, "DELETE", SCHEDULER + "delete/" + ownerEvent, ownerToken, null, 204, "所有者の予定削除");
        var remainingOwnerEvents = events(owner, b);
        check(remainingOwnerEvents.isArray() && remainingOwnerEvents.isEmpty() && onlyItem(events(other, a), otherEvent)
                && number("SELECT COUNT(*) FROM schedule WHERE id = ?", scheduleId) == 0,
                "予定とイベントが削除され、別ユーザーの同日イベントが残る");
        check(timeBlockingRows().equals(survivingTimeBlocking), "予定の削除でタイムテーブル・ブロック・タスクが維持される");
    }

    static String signupAndLogin(Client client, int port, String loginId) throws Exception {
        var credentials = Map.of("loginId", loginId, "password", "Session190Check!");
        String preLogin = client.token(port);
        expectStatus(client, port, "POST", "/api/signup", preLogin, credentials, 200, "独立性検証用ユーザー登録");
        expectStatus(client, port, "POST", "/api/login", preLogin, credentials, 200, "独立性検証用ユーザーで認証");
        return client.token(port);
    }

    static Map<String, Object> blockBody(long tableId, String title) {
        return new HashMap<>(Map.of("timeTableId", tableId, "title", title, "status", "PLACED",
                "width", 90, "startAt", "09:15:00", "color", "#123456"));
    }

    static JsonNode events(Client client, int port) throws Exception {
        return JSON.readTree(expectStatus(client, port, "GET", SCHEDULER + "getEvents/" + DATE + "/" + DATE,
                null, null, 200, "同日の予定一覧を取得").body());
    }

    static JsonNode timeTable(Client client, int port) throws Exception {
        return JSON.readTree(expectStatus(client, port, "GET", TIMEBLOCKING + "timeTable/getByDate/" + DATE,
                null, null, 200, "同日のタイムテーブルを取得").body());
    }

    static boolean onlyItem(JsonNode items, long id) {
        return items.isArray() && items.size() == 1 && items.path(0).path("id").asLong() == id;
    }

    static long createdId(Client client, int port, String method, String path, String token, Map<String, ?> body,
            String label) throws Exception {
        long id = JSON.readTree(expectStatus(client, port, method, path, token, body, 201, label).body()).asLong();
        check(id > 0, label + "のIDが返る");
        return id;
    }

    static HttpResponse<String> expectStatus(Client client, int port, String method, String path, String token,
            Map<String, ?> body, int expected, String label) throws Exception {
        var response = client.call(port, method, path, token, body == null ? null : JSON.writeValueAsString(body));
        check(response.statusCode() == expected, label + " (HTTP " + response.statusCode() + ")");
        return response;
    }

    static List<List<List<String>>> calendarRows() throws SQLException {
        return List.of(rows("SELECT * FROM schedule ORDER BY id"), rows("SELECT * FROM calendar_event ORDER BY id"));
    }

    static List<List<List<String>>> timeBlockingRows() throws SQLException {
        return List.of(rows("SELECT * FROM time_tables ORDER BY id"), rows("SELECT * FROM time_blocks ORDER BY id"),
                rows("SELECT * FROM time_block_tasks ORDER BY id"));
    }

    static List<List<String>> rows(String sql) throws SQLException {
        List<List<String>> rows = new ArrayList<>();
        try (Statement statement = db.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            int columns = result.getMetaData().getColumnCount();
            while (result.next()) {
                List<String> row = new ArrayList<>();
                for (int column = 1; column <= columns; column++) row.add(result.getString(column));
                rows.add(row);
            }
        }
        return rows;
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
        if (!condition) {
            System.out.println("FAIL " + label);
            throw new IllegalStateException(label);
        }
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
