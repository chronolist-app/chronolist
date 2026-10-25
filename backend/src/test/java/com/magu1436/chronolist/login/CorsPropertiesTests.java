package com.magu1436.chronolist.login;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import com.magu1436.chronolist.login.config.CorsProperties;

class CorsPropertiesTests {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(PropertiesConfiguration.class);

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(CorsProperties.class)
    static class PropertiesConfiguration {
    }

    @ParameterizedTest
    @ValueSource(strings = {"dev", "test"})
    void localProfilesHaveDefaultOrigin(String profile) {
        runner.withPropertyValues("spring.profiles.active=" + profile).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(CorsProperties.class).allowedOrigins()).containsExactly("http://localhost:5173");
        });
    }

    @Test
    void prodRequiresExplicitOrigin() {
        runner.withPropertyValues("spring.profiles.active=prod").run(context -> assertThat(context).hasFailed());
    }

    @Test
    void prodBindsExternalOriginsWithoutDevelopmentFallback() {
        runner.withPropertyValues("spring.profiles.active=prod",
                "FRONTEND_ORIGIN=https://chronolist.example,https://preview.example").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(CorsProperties.class).allowedOrigins())
                    .containsExactly("https://chronolist.example", "https://preview.example");
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"*", "https://*.example.com", "null", "https://example.com/", "https://example.com/api",
            "https://user:password@example.com", "https://example.com?q=1", "https://example.com#fragment",
            "ftp://example.com", "http://localhost:0", "http://localhost:65536", ""})
    void rejectsInvalidOrigins(String origin) {
        runner.withPropertyValues("spring.profiles.active=prod", "FRONTEND_ORIGIN=" + origin)
                .run(context -> assertThat(context).hasFailed());
    }
}
