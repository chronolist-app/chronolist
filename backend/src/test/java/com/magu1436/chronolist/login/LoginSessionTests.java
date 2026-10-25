package com.magu1436.chronolist.login;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
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
        Session stored = sessions.findById(sessionId(cookie));
        assertThat(stored).isNotNull();
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
        mockMvc.perform(post("/api/logout").cookie(cookie)).andExpect(status().isOk());

        assertThat(sessions.findById(sessionId(cookie))).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES", Integer.class)).isZero();
        mockMvc.perform(get("/api/todolist/getAll").cookie(cookie)).andExpect(status().isUnauthorized());
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
        // Step 3 will set JSESSIONID explicitly; Spring Session currently uses its SESSION default.
        return new Cookie("SESSION", Base64.getEncoder().encodeToString(session.getId().getBytes(StandardCharsets.UTF_8)));
    }

    private String sessionId(Cookie cookie) {
        return new String(Base64.getDecoder().decode(cookie.getValue()), StandardCharsets.UTF_8);
    }
}
