package com.magu1436.chronolist.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.sql.init.SqlInitializationAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseProfileTests {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withConfiguration(AutoConfigurations.of(
                    DataSourceAutoConfiguration.class, SqlInitializationAutoConfiguration.class));

    @Test
    void devLoadsSchemaAndSampleData() {
        runner.withPropertyValues("spring.profiles.active=dev").run(context -> {
            assertThat(context).hasNotFailed();
            var jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE login_id = 'admin'", Integer.class))
                    .isEqualTo(1);
        });
    }

    @Test
    void testLoadsSchemaWithoutDevelopmentData() {
        runner.withPropertyValues("spring.profiles.active=test").run(context -> {
            assertThat(context).hasNotFailed();
            var jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isZero();
        });
    }

    @Test
    void defaultDoesNotInitializeSchema() {
        runner.withPropertyValues("spring.datasource.url=jdbc:h2:mem:uninitialized-" + java.util.UUID.randomUUID()).run(context -> {
            assertThat(context).hasNotFailed();
            var jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            assertThat(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = 'USERS'",
                    Integer.class)).isZero();
        });
    }

    @Test
    void prodDoesNotInitializeOrConnectOnStartup() {
        runner.withPropertyValues("spring.profiles.active=prod",
                "DB_URL=jdbc:mysql://127.0.0.1:1/unused?sslMode=VERIFY_IDENTITY",
                "DB_USERNAME=unused", "DB_PASSWORD=unused").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getEnvironment().getProperty("spring.sql.init.mode")).isEqualTo("never");
            assertThat(context.getEnvironment().getProperty("spring.h2.console.enabled")).isEqualTo("false");
        });
    }
}
