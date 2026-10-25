package com.magu1436.chronolist.login.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.userdetails.UserDetailsService;


import com.magu1436.chronolist.login.JsonLoginFilter;
import com.magu1436.chronolist.login.Handler.CustomFailureHandler;
import com.magu1436.chronolist.login.Handler.CustomSuccessHandler;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    
    private final AuthenticationConfiguration authenticationConfiguration;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public DaoAuthenticationProvider authenticationProvider(UserDetailsService userDetailsService) {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder); // フィールドを使用
        return authProvider;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(final HttpSecurity http) throws Exception {
        http
            // CORSの設定
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // CSRFの無効化
            .csrf(csrf -> csrf.disable())
            .authenticationManager(authenticationManager())
            // SPA APIs return 401 directly; saved-request sessions are unnecessary.
            .requestCache(cache -> cache.disable())
            .securityContext(context -> context.securityContextRepository(securityContextRepository()))
            // Until CSRF validation is enabled, register its login-time reset explicitly.
            // Step 4 will move this registration to CsrfConfigurer, using the same repository.
            .sessionManagement(session -> session.addSessionAuthenticationStrategy(
                new CsrfAuthenticationStrategy(csrfTokenRepository())))
            .with(new JsonLoginConfigurer(), configurer -> {})

            // 未認証の時点で認証が必要なページへのアクセスが行われた際のレスポンス
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            })
        )

            .authorizeHttpRequests(auth -> auth
                // 各ページへのアクセス許可設定
                .requestMatchers( "/api/signup").permitAll()
                .requestMatchers( "/api/**").authenticated()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .logout(logout -> logout
                .logoutRequestMatcher(
                    PathPatternRequestMatcher.withDefaults()
                        .matcher(HttpMethod.POST, "/api/logout")
                )
                .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler())
                // Spring Session expires the cookie through the same serializer used to issue it.
                .invalidateHttpSession(true)
            )

            // H2 Console をフレーム内で表示できるように許可する設定
            .headers(headers -> headers
                .frameOptions(frameOptions -> frameOptions.sameOrigin())
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // フロントエンドのURLを指定
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));
        
        // 許可するHTTPメソッド
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        
        // 許可するヘッダー
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        
        // Cookieなどの認証情報の共有を許可
        configuration.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new DelegatingSecurityContextRepository(
                new RequestAttributeSecurityContextRepository(),
                new HttpSessionSecurityContextRepository());
    }

    @Bean
    public HttpSessionCsrfTokenRepository csrfTokenRepository() {
        return new HttpSessionCsrfTokenRepository();
    }

    /** Build inside Security only, after its shared repositories and strategies are initialized. */
    private static final class JsonLoginConfigurer extends AbstractHttpConfigurer<JsonLoginConfigurer, HttpSecurity> {
        @Override
        public void configure(HttpSecurity http) {
            JsonLoginFilter filter = new JsonLoginFilter();
            filter.setAuthenticationManager(http.getSharedObject(AuthenticationManager.class));
            filter.setSecurityContextRepository(http.getSharedObject(SecurityContextRepository.class));
            filter.setSessionAuthenticationStrategy(http.getSharedObject(SessionAuthenticationStrategy.class));
            filter.setAuthenticationSuccessHandler(new CustomSuccessHandler());
            filter.setAuthenticationFailureHandler(new CustomFailureHandler());
            filter.setRequiresAuthenticationRequestMatcher(
                    PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/login"));
            http.addFilterAt(postProcess(filter), UsernamePasswordAuthenticationFilter.class);
        }
    }

    @Bean
    public AuthenticationManager authenticationManager() throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}
