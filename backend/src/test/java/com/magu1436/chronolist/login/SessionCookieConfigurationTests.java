package com.magu1436.chronolist.login;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;

import com.magu1436.chronolist.login.config.SessionCookieConfiguration;

class SessionCookieConfigurationTests {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(SessionCookieConfiguration.class, PropertiesConfiguration.class);

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(ServerProperties.class)
    static class PropertiesConfiguration {
    }

    @ParameterizedTest
    @CsvSource({"dev,false", "test,false", "prod,true"})
    void issuanceAndDeletionUseMatchingProfileAttributes(String profile, boolean secure) {
        runner.withPropertyValues("spring.profiles.active=" + profile).run(context -> {
            assertThat(context).hasNotFailed();
            var resolver = context.getBean(CookieHttpSessionIdResolver.class);
            // Even behind HTTP forwarding, prod must issue Secure cookies.
            var request = new MockHttpServletRequest();
            var issued = new MockHttpServletResponse();
            resolver.setSessionId(request, issued, "session-id");
            var cookie = issued.getCookie("JSESSIONID");
            assertThat(cookie).isNotNull();
            assertThat(cookie.getSecure()).isEqualTo(secure);
            assertThat(cookie.isHttpOnly()).isTrue();
            assertThat(cookie.getPath()).isEqualTo("/");
            assertThat(cookie.getDomain()).isNull();
            assertThat(cookie.getMaxAge()).isEqualTo(604800);
            assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");

            var deleted = new MockHttpServletResponse();
            resolver.expireSession(request, deleted);
            var expired = deleted.getCookie("JSESSIONID");
            assertThat(expired.getMaxAge()).isZero();
            assertThat(expired.getValue()).isEmpty();
            assertThat(expired.getSecure()).isEqualTo(secure);
            assertThat(expired.isHttpOnly()).isTrue();
            assertThat(expired.getPath()).isEqualTo(cookie.getPath());
            assertThat(expired.getDomain()).isNull();
            assertThat(expired.getAttribute("SameSite")).isEqualTo(cookie.getAttribute("SameSite"));
        });
    }

    @Test
    void cookieDurationDefaultsToOverriddenSessionTimeout() {
        runner.withPropertyValues("spring.profiles.active=test", "spring.session.timeout=1d").run(context -> {
            assertThat(context).hasNotFailed();
            var response = new MockHttpServletResponse();
            context.getBean(CookieHttpSessionIdResolver.class)
                    .setSessionId(new MockHttpServletRequest(), response, "session-id");
            assertThat(response.getCookie("JSESSIONID").getMaxAge()).isEqualTo(86400);
        });
    }

    @Test
    void cookieDurationCanBeOverriddenIndependently() {
        runner.withPropertyValues("spring.profiles.active=test", "server.servlet.session.cookie.max-age=2d")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    var response = new MockHttpServletResponse();
                    context.getBean(CookieHttpSessionIdResolver.class)
                            .setSessionId(new MockHttpServletRequest(), response, "session-id");
                    assertThat(response.getCookie("JSESSIONID").getMaxAge()).isEqualTo(172800);
                });
    }

    @Test
    void rejectsNonPersistentCookieDuration() {
        runner.withPropertyValues("spring.profiles.active=test", "server.servlet.session.cookie.max-age=0s")
                .run(context -> assertThat(context).hasFailed());
    }
}
