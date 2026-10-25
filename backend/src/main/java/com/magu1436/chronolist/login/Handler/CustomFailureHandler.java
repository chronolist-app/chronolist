package com.magu1436.chronolist.login.Handler;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.AuthenticationEntryPoint;
import java.io.IOException;

/**
 * ログイン失敗時も共通の401 JSON応答を返すハンドラ。
 */
public class CustomFailureHandler implements AuthenticationFailureHandler {
    private final AuthenticationEntryPoint entryPoint;

    public CustomFailureHandler(AuthenticationEntryPoint entryPoint) {
        this.entryPoint = entryPoint;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, 
                                        HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        entryPoint.commence(request, response, exception);
    }
}
