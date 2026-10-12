package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.SqlCommandType;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Signature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

/** 実DBで最初の変更を実行した後に後続処理を失敗させ、APIのロールバックを検証する. */
@Import(TimeBlockRollbackApiTests.FailureConfiguration.class)
class TimeBlockRollbackApiTests extends TimeBlockingApiTest {

    @Autowired
    private FailNextResourceWrite failure;

    @AfterEach
    void disarmFailure() {
        failure.disarm();
    }

    /** ブロック・予定のどちらを先に変更しても、後続の失敗で全変更を戻す. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void laterResourceFailureRollsBackAllChanges(String operation) throws Exception {
        int ownSchedule = schedule();
        int ownTable = table("2026-10-12");
        int id = block(ownTable, "PLACED", ownSchedule);
        task(id, "ロールバック対象");
        int otherUser = createUser("other-user");
        task(block(otherUser, null, "HOLD", schedule(otherUser)), "保持する他ユーザーの作業");
        var before = databaseState();
        Map<String, Object> body;
        if (operation.equals("update")) {
            body = blockBody(ownTable, "PLACED");
            body.put("id", id);
            body.put("relatedSchedule", Map.of("id", ownSchedule, "kind", "ALL_DAY",
                    "startDate", "2026-11-01", "endDate", "2026-11-02", "title", "更新予定"));
        } else {
            body = Map.of("id", id, "relatedSchedule", Map.of("id", ownSchedule));
        }

        failure.arm();
        performJsonAsUser(operation.equals("delete") ? delete(BASE + "timeBlock/delete")
                : put(BASE + "timeBlock/update"), body).andExpect(status().isInternalServerError());

        // 事前検証による拒否や最初のSQLの失敗を、ロールバック成功として扱わない.
        assertThat(failure.firstAffectedRows).as("最初の実SQLがデータを変更した件数").isPositive();
        assertThat(failure.injected).as("別リソースの後続書き込みで失敗を注入したこと").isTrue();
        assertThat(databaseState()).isEqualTo(before);
    }

    private Map<String, List<Map<String, Object>>> databaseState() {
        return Map.of(
                "tables", jdbcTemplate.queryForList("SELECT * FROM time_tables ORDER BY id"),
                "blocks", jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id"),
                "tasks", jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id"),
                "schedules", jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id"),
                "events", jdbcTemplate.queryForList("SELECT * FROM calendar_event ORDER BY id"));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FailureConfiguration {
        @Bean
        FailNextResourceWrite failNextResourceWrite() {
            return new FailNextResourceWrite();
        }
    }

    /** Mapperをモック化せず、最初の実SQL成功後に別リソースの書き込みだけを失敗させる. */
    @Intercepts(@Signature(type = Executor.class, method = "update",
            args = {MappedStatement.class, Object.class}))
    static class FailNextResourceWrite implements Interceptor {
        private boolean armed;
        private String firstResource;
        private int firstAffectedRows;
        private boolean injected;

        void arm() {
            firstResource = null;
            firstAffectedRows = 0;
            injected = false;
            armed = true;
        }

        void disarm() {
            armed = false;
        }

        @Override
        public Object intercept(Invocation invocation) throws Throwable {
            MappedStatement statement = (MappedStatement) invocation.getArgs()[0];
            String resource = resourceOf(statement);
            if (!armed || resource == null) return invocation.proceed();
            if (firstResource != null && !firstResource.equals(resource)) {
                injected = true;
                armed = false;
                throw new IllegalStateException("API rollback test: injected failure after first resource write");
            }
            Object result = invocation.proceed();
            if (firstResource == null && result instanceof Integer affectedRows && affectedRows > 0) {
                firstResource = resource;
                firstAffectedRows = affectedRows;
            }
            return result;
        }

        private String resourceOf(MappedStatement statement) {
            if (statement.getSqlCommandType() != SqlCommandType.UPDATE
                    && statement.getSqlCommandType() != SqlCommandType.DELETE) return null;
            String id = statement.getId();
            if (id.startsWith("com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper.")) return "block";
            if (id.startsWith("com.magu1436.chronolist.scheduler.mapper.SchedulerMapper.")
                    && (id.endsWith(".updateSchedule") || id.endsWith(".deleteSchedule"))) return "schedule";
            return null;
        }
    }
}
