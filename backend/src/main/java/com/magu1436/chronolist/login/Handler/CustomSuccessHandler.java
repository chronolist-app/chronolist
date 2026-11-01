package com.magu1436.chronolist.login.Handler;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import java.io.IOException;

/**
 * フィルタによる認証情報の保存後、リダイレクトせずHTTP 200を返すハンドラ。
 */
public class CustomSuccessHandler implements AuthenticationSuccessHandler {

    /**
     * 認証情報の保存はフィルタのSecurityContextRepositoryへ任せる。
     *
     * @param request        認証に成功したHTTPリクエスト
     * @param response       ステータス 200 を設定するレスポンス
     * @param authentication ログイン成功後に渡される認証情報
     * @throws IOException   レスポンス書き込みに失敗した場合
     */
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        response.setStatus(HttpServletResponse.SC_OK);
    }
}
