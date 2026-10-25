package com.magu1436.chronolist.login;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;

import com.magu1436.chronolist.support.ApiIntegrationTest;

/** Real JDBC storage tests; login/filter and browser cookie flows are tested separately. */
class JdbcSessionRepositoryTests extends ApiIntegrationTest {

    @Autowired
    private JdbcIndexedSessionRepository jdbcSessions;

    private SessionRepository<Session> sessions;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void usePublicSessionInterface() {
        // JdbcSession is package-private. Every saved Session here is created by this repository.
        sessions = (SessionRepository<Session>) (SessionRepository<?>) jdbcSessions;
    }

    @Test
    void restoresAuthenticationAndCsrfAttributesFromDatabase() {
        var session = sessions.createSession();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                loginUser, null, loginUser.getAuthorities()));
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        session.setAttribute("csrf", new DefaultCsrfToken("X-CSRF-TOKEN", "_csrf", "stored-token"));
        sessions.save(session);

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM SPRING_SESSION", Integer.class))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES", Integer.class)).isEqualTo(2);

        var restored = sessions.findById(session.getId());
        assertThat(restored).isNotNull();
        SecurityContext restoredContext = restored.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertThat(restoredContext).isNotSameAs(context);
        assertThat(restoredContext.getAuthentication().isAuthenticated()).isTrue();
        assertThat(restoredContext.getAuthentication().getPrincipal()).isInstanceOf(LoginUser.class);
        assertThat(((LoginUser) restoredContext.getAuthentication().getPrincipal()).getId())
                .isEqualTo(loginUser.getId());
        DefaultCsrfToken csrf = restored.getAttribute("csrf");
        assertThat(csrf.getToken()).isEqualTo("stored-token");
        assertThat(csrf.getHeaderName()).isEqualTo("X-CSRF-TOKEN");
    }

    @Test
    void updatesRotatesAndDeletesStoredSession() {
        var session = sessions.createSession();
        session.setAttribute("value", "initial");
        sessions.save(session);
        String oldId = session.getId();

        var restored = sessions.findById(oldId);
        restored.setAttribute("value", "updated");
        restored.changeSessionId();
        sessions.save(restored);

        assertThat(sessions.findById(oldId)).isNull();
        assertThat(sessions.findById(restored.getId()).<String>getAttribute("value"))
                .isEqualTo("updated");
        sessions.deleteById(restored.getId());
        assertThat(sessions.findById(restored.getId())).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES", Integer.class)).isZero();
    }

    @Test
    void rejectsExpiredSessionBeforeScheduledCleanup() {
        var session = sessions.createSession();
        sessions.save(session);
        expire(session.getId());

        assertThat(sessions.findById(session.getId())).isNull();
    }

    @Test
    void cleanupRemovesExpiredAttributesButKeepsActiveSessions() {
        var expired = sessions.createSession();
        expired.setAttribute("value", "expired");
        sessions.save(expired);
        var active = sessions.createSession();
        active.setAttribute("value", "active");
        sessions.save(active);
        expire(expired.getId());

        jdbcSessions.cleanUpExpiredSessions();

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM SPRING_SESSION", Integer.class))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES", Integer.class)).isEqualTo(1);
        assertThat(sessions.findById(active.getId()).<String>getAttribute("value")).isEqualTo("active");
    }

    private void expire(String sessionId) {
        long lastAccess = Instant.now().minusSeconds(60).toEpochMilli();
        jdbcTemplate.update("UPDATE SPRING_SESSION SET LAST_ACCESS_TIME = ?, "
                + "MAX_INACTIVE_INTERVAL = 1, EXPIRY_TIME = ? WHERE SESSION_ID = ?",
                lastAccess, lastAccess + 1000, sessionId);
    }
}
