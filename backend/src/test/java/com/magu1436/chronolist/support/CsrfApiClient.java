package com.magu1436.chronolist.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.Cookie;

/** Obtain real masked CSRF tokens and cookies using the same API as the Frontend. */
public final class CsrfApiClient {
    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;

    public CsrfApiClient(MockMvc mockMvc, ObjectMapper objectMapper) {
        this.mockMvc = mockMvc;
        this.objectMapper = objectMapper;
    }

    public CsrfState acquire(Cookie... cookies) throws Exception {
        var request = get("/api/csrf");
        if (cookies.length > 0) {
            request.cookie(cookies);
        }
        var response = mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse();
        var body = objectMapper.readTree(response.getContentAsByteArray());
        Cookie cookie = response.getCookie("JSESSIONID");
        if (cookie == null && cookies.length > 0) {
            cookie = cookies[0];
        }
        if (cookie == null) {
            throw new IllegalStateException("CSRF token API did not establish a session cookie");
        }
        return new CsrfState(body.get("token").asText(), body.get("headerName").asText(), cookie);
    }

    public record CsrfState(String token, String headerName, Cookie cookie) {
    }
}
