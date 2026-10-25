package com.magu1436.chronolist.login;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.magu1436.chronolist.support.ApiIntegrationTest;
import com.magu1436.chronolist.support.CsrfApiClient;
import com.magu1436.chronolist.support.CsrfApiClient.CsrfState;

import jakarta.servlet.http.Cookie;

/** Exercise CSRF over real token-API, login and cookie requests without mocked CSRF post-processors. */
class CsrfProtectionTests extends ApiIntegrationTest {
    private static final String PASSWORD = "password123";

    @Autowired
    private PasswordEncoder passwordEncoder;

    private CsrfApiClient client;

    @BeforeEach
    void prepareLogin() {
        client = new CsrfApiClient(mockMvc, objectMapper);
        jdbcTemplate.update("UPDATE users SET password = ? WHERE id = ?",
                passwordEncoder.encode(PASSWORD), loginUser.getId());
    }

    @Test
    void anonymousTokenEndpointReturnsOnlyRequiredFieldsWithoutCaching() throws Exception {
        var response = mockMvc.perform(get("/api/csrf").header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andReturn().getResponse();
        assertThat(objectMapper.readTree(response.getContentAsByteArray()).size()).isEqualTo(2);
        assertThat(response.getCookie("JSESSIONID")).isNotNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES", Integer.class)).isEqualTo(1);
        mockMvc.perform(get("/api/todolist/getAll").cookie(response.getCookie("JSESSIONID")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void maskedTokenChangesBetweenFetchesButEarlierTokenStillWorksForSignup() throws Exception {
        CsrfState first = client.acquire();
        CsrfState second = client.acquire(first.cookie());
        assertThat(second.token()).isNotEqualTo(first.token());

        mockMvc.perform(post("/api/signup").cookie(second.cookie()).header(first.headerName(), first.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(Map.of("loginId", "csrfnewuser", "password", PASSWORD))))
                .andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE login_id = 'csrfnewuser'", Integer.class)).isEqualTo(1);
    }

    @Test
    void tokenFromDifferentSessionCannotAuthenticate() throws Exception {
        CsrfState first = client.acquire();
        CsrfState second = client.acquire();
        assertThat(second.cookie().getValue()).isNotEqualTo(first.cookie().getValue());
        mockMvc.perform(post("/api/login").cookie(second.cookie()).header(first.headerName(), first.token())
                .contentType(MediaType.APPLICATION_JSON).content(credentials()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME IS NOT NULL", Integer.class)).isZero();
    }

    @Test
    void frontendFlowRefreshesAfterLoginAndLogoutAndAllowsCrud() throws Exception {
        CsrfState beforeLogin = client.acquire();
        Cookie cookie = login(beforeLogin);
        byte[] createBody = objectMapper.writeValueAsBytes(Map.of(
                "title", "csrf task", "priority", "MIDDLE", "dueKind", "NONE"));

        mockMvc.perform(post("/api/todolist/register").cookie(cookie)
                .header(beforeLogin.headerName(), beforeLogin.token())
                .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));
        assertThat(taskCount()).isZero();

        CsrfState afterLogin = client.acquire(cookie);
        mockMvc.perform(get("/api/todolist/getAll").cookie(cookie)).andExpect(status().isOk());
        mockMvc.perform(head("/api/todolist/getAll").cookie(cookie)).andExpect(status().isOk());
        var created = mockMvc.perform(post("/api/todolist/register").cookie(cookie)
                .header(afterLogin.headerName(), afterLogin.token())
                .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isOk()).andReturn();
        int id = objectMapper.readValue(created.getResponse().getContentAsByteArray(), Integer.class);

        mockMvc.perform(put("/api/todolist/update/status").cookie(cookie)
                .header(afterLogin.headerName(), afterLogin.token()).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(Map.of("id", id, "isCompleted", true))))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT is_completed FROM todo_tasks WHERE id = ?", Boolean.class, id))
                .isTrue();
        mockMvc.perform(delete("/api/todolist/delete").cookie(cookie)
                .header(afterLogin.headerName(), afterLogin.token()).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(Map.of("id", id))))
                .andExpect(status().isNoContent());
        assertThat(taskCount()).isZero();

        mockMvc.perform(post("/api/logout").cookie(cookie).header(afterLogin.headerName(), afterLogin.token()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/login").cookie(cookie).header(afterLogin.headerName(), afterLogin.token())
                .contentType(MediaType.APPLICATION_JSON).content(credentials()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));
        login(client.acquire(cookie));
    }

    @ParameterizedTest
    @CsvSource({"POST,false", "POST,true", "PUT,false", "PUT,true", "DELETE,false", "DELETE,true",
            "PATCH,false", "PATCH,true"})
    void authenticatedMutationsRejectMissingOrInvalidTokenWithoutChangingData(String method, boolean invalid)
            throws Exception {
        Cookie cookie = login(client.acquire());
        client.acquire(cookie);
        jdbcTemplate.update("INSERT INTO todo_tasks (user_id, title, priority, due_kind) VALUES (?, ?, ?, ?)",
                loginUser.getId(), "unchanged", "MIDDLE", "NONE");
        Integer id = jdbcTemplate.queryForObject("SELECT id FROM todo_tasks", Integer.class);
        String path = switch (method) {
            case "POST" -> "/api/todolist/register";
            case "DELETE" -> "/api/todolist/delete";
            default -> "/api/todolist/update/status";
        };
        var request = request(HttpMethod.valueOf(method), path).cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(Map.of("id", id, "title", "changed",
                        "priority", "MIDDLE", "dueKind", "NONE", "isCompleted", true)));
        if (invalid) {
            request.header("X-CSRF-TOKEN", "invalid-token");
        }
        mockMvc.perform(request).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));
        assertThat(taskCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT title FROM todo_tasks WHERE id = ?", String.class, id))
                .isEqualTo("unchanged");
        assertThat(jdbcTemplate.queryForObject("SELECT is_completed FROM todo_tasks WHERE id = ?", Boolean.class, id))
                .isFalse();
    }

    @ParameterizedTest
    @CsvSource({"/api/login,false", "/api/login,true", "/api/signup,false", "/api/signup,true"})
    void publicAuthenticationEndpointsStillRequireValidCsrf(String path, boolean invalid) throws Exception {
        var request = post(path).contentType(MediaType.APPLICATION_JSON).content(credentials());
        if (invalid) {
            request.header("X-CSRF-TOKEN", "invalid-token");
        }
        mockMvc.perform(request).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME IS NOT NULL", Integer.class)).isZero();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void invalidLogoutDoesNotInvalidateAuthenticatedSession(boolean invalid) throws Exception {
        Cookie cookie = login(client.acquire());
        var request = post("/api/logout").cookie(cookie);
        if (invalid) {
            request.header("X-CSRF-TOKEN", "invalid-token");
        }
        mockMvc.perform(request).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));
        mockMvc.perform(get("/api/todolist/getAll").cookie(cookie)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "invalid", "valid"})
    void unauthenticatedProtectedMutationReturns401RegardlessOfCsrf(String token) throws Exception {
        var request = post("/api/todolist/register").contentType(MediaType.APPLICATION_JSON).content("{}");
        if (token.equals("valid")) {
            CsrfState csrf = client.acquire();
            request.cookie(csrf.cookie()).header(csrf.headerName(), csrf.token());
        } else if (token.equals("invalid")) {
            request.header("X-CSRF-TOKEN", "invalid-token");
        }
        mockMvc.perform(request).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        assertThat(taskCount()).isZero();
    }

    @Test
    void expiredProtectedMutationReturns401InsteadOfCsrf403() throws Exception {
        Cookie cookie = login(client.acquire());
        long lastAccess = Instant.now().minus(Duration.ofDays(8)).toEpochMilli();
        String id = new String(Base64.getDecoder().decode(cookie.getValue()), StandardCharsets.UTF_8);
        jdbcTemplate.update("UPDATE SPRING_SESSION SET LAST_ACCESS_TIME = ?, EXPIRY_TIME = ? WHERE SESSION_ID = ?",
                lastAccess, lastAccess + Duration.ofDays(7).toMillis(), id);
        mockMvc.perform(post("/api/todolist/register").cookie(cookie)
                .header("X-CSRF-TOKEN", "stale-token").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        assertThat(taskCount()).isZero();
    }

    @Test
    void authorizationFailureIsNotReportedAsCsrfFailure() throws Exception {
        Cookie cookie = login(client.acquire());
        mockMvc.perform(get("/admin/anything").cookie(cookie)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void corsPreflightAllowsCsrfHeaderWithoutAuthenticationOrToken() throws Exception {
        mockMvc.perform(options("/api/todolist/register").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,x-csrf-token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"))
                .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsString("x-csrf-token")));
    }

    private Cookie login(CsrfState csrf) throws Exception {
        var response = mockMvc.perform(post("/api/login").cookie(csrf.cookie())
                .header(csrf.headerName(), csrf.token()).contentType(MediaType.APPLICATION_JSON).content(credentials()))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie cookie = response.getCookie("JSESSIONID");
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private byte[] credentials() throws Exception {
        return objectMapper.writeValueAsBytes(Map.of("loginId", loginUser.getUsername(), "password", PASSWORD));
    }

    private int taskCount() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM todo_tasks", Integer.class);
    }
}
