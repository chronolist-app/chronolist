package com.magu1436.chronolist.login.Handler;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationTrustResolverImpl;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Distinguish expired authentication, CSRF failures and ordinary authorization failures. */
@Component
public final class ApiSecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper;
    private final AuthenticationTrustResolverImpl trustResolver = new AuthenticationTrustResolverImpl();
    private final RequestMatcher publicAuthentication = new OrRequestMatcher(
            PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/login"),
            PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/signup"));

    public ApiSecurityErrorHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException {
        writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException exception)
            throws IOException {
        if (exception instanceof CsrfException) {
            boolean authenticated = trustResolver.isAuthenticated(SecurityContextHolder.getContext().getAuthentication());
            if (!authenticated && !publicAuthentication.matches(request)) {
                // CsrfFilter runs before authorization: an expired protected request still needs a 401.
                writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED");
                return;
            }
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "CSRF_TOKEN_INVALID");
            return;
        }
        writeError(response, HttpServletResponse.SC_FORBIDDEN, "ACCESS_DENIED");
    }

    private void writeError(HttpServletResponse response, int status, String code) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Cache-Control", "no-store");
        objectMapper.writeValue(response.getOutputStream(), Map.of("code", code));
    }
}
