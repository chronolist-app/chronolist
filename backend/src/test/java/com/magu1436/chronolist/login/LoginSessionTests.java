package com.magu1436.chronolist.login;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Collections;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.test.web.servlet.MvcResult;

import com.magu1436.chronolist.support.ApiIntegrationTest;

import jakarta.servlet.http.Cookie;

/** Uses real JSON login and cookies, without injecting an authenticated test Principal. */
class LoginSessionTests extends ApiIntegrationTest {

    private static final String PASSWORD = "test-password";

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcIndexedSessionRepository jdbcSessions;

    @Autowired
    private HttpSessionCsrfTokenRepository csrfTokens;

    private SessionRepository<Session> sessions;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void prepareLogin() {
        // JdbcSession is package-private; only save sessions created by this repository.
        sessions = (SessionRepository<Session>) (SessionRepository<?>) jdbcSessions;
        jdbcTemplate.update("UPDATE users SET password = ? WHERE id = ?",
                passwordEncoder.encode(PASSWORD), loginUser.getId());
    }

    @Test
    void loginPersistsAuthenticationAndCookieAuthenticatesNextRequest() throws Exception {
        Cookie cookie = login(PASSWORD);
        assertThat(cookie.getName()).isEqualTo("JSESSIONID");
        assertThat(cookie.getMaxAge()).isEqualTo(604800);
        assertThat(cookie.getPath()).isEqualTo("/");
        assertThat(cookie.getDomain()).isNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSecure()).isFalse();
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
        Session stored = sessions.findById(sessionId(cookie));
        assertThat(stored).isNotNull();
        assertThat(stored.getMaxInactiveInterval()).isEqualTo(Duration.ofDays(7));
        SecurityContext context = stored.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertThat(context.getAuthentication().isAuthenticated()).isTrue();
        assertThat(context.getAuthentication().getPrincipal()).isInstanceOf(LoginUser.class);
        LoginUser principal = (LoginUser) context.getAuthentication().getPrincipal();
        assertThat(principal.getId()).isEqualTo(loginUser.getId());
        assertThat(principal.getPassword()).isNull();
        assertThat(context.getAuthentication().getCredentials()).isNull();

        mockMvc.perform(get("/api/todolist/getAll").cookie(cookie)).andExpect(status().isOk());
        mockMvc.perform(get("/api/todolist/getAll")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginRotatesExistingSessionAndDiscardsItsCsrfToken() throws Exception {
        Session anonymous = sessions.createSession();
        anonymous.setAttribute("pre-login", "retained");
        MockHttpServletRequest tokenRequest = new MockHttpServletRequest();
        csrfTokens.saveToken(csrfTokens.generateToken(tokenRequest), tokenRequest, new MockHttpServletResponse());
        for (String name : Collections.list(tokenRequest.getSession().getAttributeNames())) {
            anonymous.setAttribute(name, tokenRequest.getSession().getAttribute(name));
        }
        sessions.save(anonymous);

        Cookie cookie = login(PASSWORD, cookieFor(anonymous));
        assertThat(sessionId(cookie)).isNotEqualTo(anonymous.getId());
        assertThat(sessions.findById(anonymous.getId())).isNull();
        Session authenticated = sessions.findById(sessionId(cookie));
        assertThat(authenticated.<String>getAttribute("pre-login")).isEqualTo("retained");
        for (String name : Collections.list(tokenRequest.getSession().getAttributeNames())) {
            assertThat(authenticated.<Object>getAttribute(name)).isNull();
        }
        mockMvc.perform(get("/api/todolist/getAll").cookie(cookie)).andExpect(status().isOk());
        mockMvc.perform(get("/api/todolist/getAll").cookie(cookieFor(anonymous)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void failedLoginDoesNotAuthenticateOrRotateAnonymousSession() throws Exception {
        Session anonymous = sessions.createSession();
        anonymous.setAttribute("pre-login", "retained");
        sessions.save(anonymous);

        mockMvc.perform(post("/api/login").cookie(cookieFor(anonymous))
                .contentType(MediaType.APPLICATION_JSON).content(credentials("wrong-password")))
                .andExpect(status().isUnauthorized());

        Session stored = sessions.findById(anonymous.getId());
        assertThat(stored).isNotNull();
        assertThat(stored.<Object>getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY))
                .isNull();
        assertThat(stored.<String>getAttribute("pre-login")).isEqualTo("retained");
        mockMvc.perform(get("/api/todolist/getAll").cookie(cookieFor(anonymous)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getCannotSubmitLoginCredentials() throws Exception {
        mockMvc.perform(get("/api/login").contentType(MediaType.APPLICATION_JSON).content(credentials(PASSWORD)))
                .andExpect(status().isUnauthorized());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME IS NOT NULL", Integer.class)).isZero();
    }

    @Test
    void logoutInvalidatesStoredSessionAndOldCookie() throws Exception {
        Cookie cookie = login(PASSWORD);
        MvcResult logout = mockMvc.perform(post("/api/logout").cookie(cookie))
                .andExpect(status().isOk()).andReturn();
        // Spring Session may commit invalidation both at response commit and filter completion.
        assertThat(logout.getResponse().getCookies()).isNotEmpty().allSatisfy(deleted -> {
            assertThat(deleted.getName()).isEqualTo(cookie.getName());
            assertThat(deleted.getMaxAge()).isZero();
            assertThat(deleted.getValue()).isEmpty();
            assertThat(deleted.getPath()).isEqualTo(cookie.getPath());
            assertThat(deleted.getDomain()).isEqualTo(cookie.getDomain());
            assertThat(deleted.getSecure()).isEqualTo(cookie.getSecure());
            assertThat(deleted.isHttpOnly()).isEqualTo(cookie.isHttpOnly());
            assertThat(deleted.getAttribute("SameSite")).isEqualTo(cookie.getAttribute("SameSite"));
        });

        assertThat(sessions.findById(sessionId(cookie))).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES", Integer.class)).isZero();
        mockMvc.perform(get("/api/todolist/getAll").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void apiUseExtendsDatabaseExpiryAndReissuesPersistentCookie() throws Exception {
        Cookie cookie = login(PASSWORD);
        long lastAccess = Instant.now().minus(Duration.ofDays(6)).toEpochMilli();
        long oldExpiry = lastAccess + Duration.ofDays(7).toMillis();
        jdbcTemplate.update("UPDATE SPRING_SESSION SET CREATION_TIME = ?, LAST_ACCESS_TIME = ?, "
                + "EXPIRY_TIME = ? WHERE SESSION_ID = ?",
                lastAccess - Duration.ofDays(1).toMillis(), lastAccess, oldExpiry, sessionId(cookie));

        MvcResult result = mockMvc.perform(get("/api/todolist/getAll").cookie(cookie))
                .andExpect(status().isOk()).andReturn();

        assertThat(result.getResponse().getCookies()).hasSize(1);
        Cookie refreshed = result.getResponse().getCookies()[0];
        assertThat(refreshed.getName()).isEqualTo(cookie.getName());
        assertThat(refreshed.getValue()).isEqualTo(cookie.getValue());
        assertThat(refreshed.getMaxAge()).isEqualTo(604800);
        assertThat(refreshed.getAttribute("Expires")).isNotBlank();
        assertThat(jdbcTemplate.queryForObject("SELECT EXPIRY_TIME FROM SPRING_SESSION WHERE SESSION_ID = ?",
                Long.class, sessionId(cookie))).isGreaterThan(oldExpiry + Duration.ofDays(5).toMillis());
    }

    @Test
    void expiredCookieDoesNotRestoreAuthenticationOrReceivePositiveMaxAge() throws Exception {
        Cookie cookie = login(PASSWORD);
        long expiredAccess = Instant.now().minus(Duration.ofDays(8)).toEpochMilli();
        jdbcTemplate.update("UPDATE SPRING_SESSION SET LAST_ACCESS_TIME = ?, EXPIRY_TIME = ? WHERE SESSION_ID = ?",
                expiredAccess, expiredAccess + Duration.ofDays(7).toMillis(), sessionId(cookie));

        MvcResult result = mockMvc.perform(get("/api/todolist/getAll").cookie(cookie))
                .andExpect(status().isUnauthorized()).andReturn();
        assertThat(result.getResponse().getCookies()).allSatisfy(reissued ->
                assertThat(reissued.getMaxAge()).isLessThanOrEqualTo(0));
        assertThat(sessions.findById(sessionId(cookie))).isNull();
    }

    private Cookie login(String password, Cookie... cookies) throws Exception {
        var request = post("/api/login").contentType(MediaType.APPLICATION_JSON).content(credentials(password));
        if (cookies.length > 0) {
            request.cookie(cookies);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getCookies()).hasSize(1);
        return result.getResponse().getCookies()[0];
    }

    private byte[] credentials(String password) throws Exception {
        return objectMapper.writeValueAsBytes(Map.of("loginId", loginUser.getUsername(), "password", password));
    }

    private Cookie cookieFor(Session session) {
        return new Cookie("JSESSIONID", Base64.getEncoder().encodeToString(session.getId().getBytes(StandardCharsets.UTF_8)));
    }

    private String sessionId(Cookie cookie) {
        return new String(Base64.getDecoder().decode(cookie.getValue()), StandardCharsets.UTF_8);
    }
}
