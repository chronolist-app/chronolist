package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import com.magu1436.chronolist.support.ApiIntegrationTest;

class ScheduleTimeBlockTests extends ApiIntegrationTest {
    protected Map<String, Object> body(String end) {
        return Map.of("kind", "DATED", "title", "予定", "startAt", "2026-11-02T09:15:00",
                "endAt", end, "color", "#123456", "memo", "");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void createsLinkedBlockAndReusesTable(boolean existing) throws Exception {
        if (existing) {
            jdbcTemplate.update("INSERT INTO time_tables (user_id, date) VALUES (?, '2026-11-02')", loginUser.getId());
        }
        var result = performJsonAsUser(post("/api/scheduler/register"), body("2026-11-02T10:45:00"))
                .andExpect(status().isCreated()).andReturn();
        int eventId = Integer.parseInt(result.getResponse().getContentAsString());
        var event = jdbcTemplate.queryForMap("SELECT * FROM calendar_event WHERE id=?", eventId);
        var block = jdbcTemplate.queryForMap("SELECT * FROM time_blocks");
        var table = jdbcTemplate.queryForMap("SELECT * FROM time_tables");
        assertThat(block).containsEntry("TITLE", "予定").containsEntry("STATUS", "PLACED")
                .containsEntry("COLOR", "#123456").containsEntry("WIDTH", 90)
                .containsEntry("START_AT", java.sql.Time.valueOf("09:15:00"))
                .containsEntry("SCHEDULE_ID", event.get("SCHEDULE_ID"))
                .containsEntry("TABLE_ID", table.get("ID")).containsEntry("USER_ID", loginUser.getId());
        assertThat(table).containsEntry("DATE", java.sql.Date.valueOf("2026-11-02"))
                .containsEntry("USER_ID", loginUser.getId());
        performJsonAsUser(post("/api/scheduler/register"), body("2026-11-02T10:45:00"))
                .andExpect(status().isCreated());
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_tables", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_blocks", Integer.class)).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"ALL_DAY", "CROSS_DAY"})
    void skipsExcludedEvents(String kind) throws Exception {
        Object input = kind.equals("ALL_DAY")
                ? Map.of("kind", "ALL_DAY", "title", "終日", "startDate", "2026-11-02", "endDate", "2026-11-03", "color", "#123456")
                : body("2026-11-03T10:45:00");
        performJsonAsUser(post("/api/scheduler/register"), input).andExpect(status().isCreated());
        for (String table : java.util.List.of("time_blocks", "time_tables")) {
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class)).isZero();
        }
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM schedule", Integer.class)).isEqualTo(1);
    }
}
