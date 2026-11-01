package com.magu1436.chronolist.login;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;

/**
 * フロントから送られてくるJSON形式のログイン情報（loginId, password）を
 * 読み取って認証処理を開始するためのカスタムフィルタです。
 */
public class JsonLoginFilter extends UsernamePasswordAuthenticationFilter {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Authentication attemptAuthentication(HttpServletRequest request, HttpServletResponse response)
            throws AuthenticationException {

        // 1. JSON形式以外のリクエストは受け付けない
        if (request.getContentType() == null || !request.getContentType().equals(MediaType.APPLICATION_JSON_VALUE)) {
            throw new AuthenticationServiceException("サポートされていない認証形式です:" + request.getMethod());
        }

        try {
            // 2. リクエストボディのJSONをLoginRequestクラスに変換
            LoginRequest loginRequest = objectMapper.readValue(request.getInputStream(), LoginRequest.class);

            // 3. 認証用のトークン（チケット）を作成
            UsernamePasswordAuthenticationToken authRequest =
                    new UsernamePasswordAuthenticationToken(loginRequest.getLoginId(), loginRequest.getPassword());

            // 4. 詳細情報をセットして、認証マネージャーに認証を依頼する
            setDetails(request, authRequest);
            return this.getAuthenticationManager().authenticate(authRequest);

        } catch (IOException e) {
            // JSONの形式が正しくない場合などのエラー
            throw new AuthenticationServiceException("認証リクエストのボディの解析に失敗しました.", e);
        }
    }

    /**
     * JSONを受け取るためだけのデータ保持用クラス（DTO）
     */
    public static class LoginRequest {
        private String loginId;
        private String password;

        // SpringがJSONをマッピングするために空のコンストラクタが必要
        public LoginRequest() {}

        public String getLoginId() { return loginId; }
        public void setLoginId(String loginId) { this.loginId = loginId; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
}