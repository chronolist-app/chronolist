package com.magu1436.chronolist.login;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;

import com.magu1436.chronolist.support.ApiIntegrationTest;

@SpringBootTest(properties = "chronolist.cors.allowed-origins=https://frontend.example")
class CorsApiTests extends ApiIntegrationTest {

    @ParameterizedTest
    @ValueSource(strings = {"/api/csrf", "/api/todolist/getAll", "/api/scheduler/getEvents?date=2026-10-26"})
    void configuredOriginReachesSecurityWithCredentialedCorsHeaders(String path) throws Exception {
        mockMvc.perform(get(path).header("Origin", "https://frontend.example"))
                .andExpect(header().string("Access-Control-Allow-Origin", "https://frontend.example"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:5173", "https://evil.example", "null"})
    void unconfiguredOriginsAreRejectedBeforeTokenIssuance(String origin) throws Exception {
        mockMvc.perform(get("/api/csrf").header("Origin", origin)).andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"))
                .andExpect(cookie().doesNotExist("JSESSIONID"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"HEAD", "POST", "PUT", "PATCH", "DELETE"})
    void preflightAllowsSupportedMethodsAndCsrfHeader(String method) throws Exception {
        mockMvc.perform(options("/api/todolist/register").header("Origin", "https://frontend.example")
                .header("Access-Control-Request-Method", method)
                .header("Access-Control-Request-Headers", "content-type,x-csrf-token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://frontend.example"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void sameOriginRequestDoesNotRequireCorsPermission() throws Exception {
        mockMvc.perform(get("/api/csrf").header("Origin", "http://localhost"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
    }
}
