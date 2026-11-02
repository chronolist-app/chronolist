package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import com.magu1436.chronolist.support.ApiIntegrationTest;

class ScheduleTimeBlockUpdateTests extends ApiIntegrationTest {
    @ParameterizedTest
    @CsvSource({"2026-11-02,false", "2026-11-03,false", "2026-11-03,true"})
    void updatesScheduleFieldsAndPreservesBlockData(String date, boolean existingTable) throws Exception {
        int eventId = register(timed("2026-11-02"));
        var before = block();
        jdbcTemplate.update("UPDATE time_blocks SET color='#abcdef' WHERE id=?", before.get("ID"));
        jdbcTemplate.update("INSERT INTO time_block_tasks (time_block_id,title) VALUES (?, '作業1'), (?, '作業2')",
                before.get("ID"), before.get("ID"));
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id");
        if (existingTable) {
            jdbcTemplate.update("INSERT INTO time_tables (user_id,date) VALUES (?,?)", loginUser.getId(), date);
        }
        var tables = jdbcTemplate.queryForList("SELECT * FROM time_tables ORDER BY id");
        var body = timed(date);
        body.put("title", "変更後");
        body.put("startAt", date + "T11:15:00");
        body.put("endAt", date + "T13:00:00");
        body.put("color", "#654321");
        update(eventId, body);
        var after = block();
        assertThat(after).containsEntry("ID", before.get("ID"))
                .containsEntry("SCHEDULE_ID", before.get("SCHEDULE_ID"))
                .containsEntry("TITLE", "変更後").containsEntry("START_AT", Time.valueOf("11:15:00"))
                .containsEntry("WIDTH", 105).containsEntry("COLOR", "#abcdef")
                .containsEntry("STATUS", before.get("STATUS"));
        var table = jdbcTemplate.queryForMap("SELECT * FROM time_tables WHERE id=?", after.get("TABLE_ID"));
        assertThat(table).containsEntry("DATE", Date.valueOf(date)).containsEntry("USER_ID", loginUser.getId());
        if (date.equals("2026-11-02") || existingTable) {
            assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables ORDER BY id")).isEqualTo(tables);
        } else {
            assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables ORDER BY id")).hasSize(2).containsAll(tables);
        }
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id")).isEqualTo(tasks);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", before.get("SCHEDULE_ID")))
                .containsEntry("TITLE", "変更後").containsEntry("START_AT", Timestamp.valueOf(date + " 11:15:00"))
                .containsEntry("END_AT", Timestamp.valueOf(date + " 13:00:00"));
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM calendar_event WHERE id=?", eventId))
                .containsEntry("COLOR", "#654321");
    }

    @ParameterizedTest
    @CsvSource({"DATED,false", "DATED,true", "ALL_DAY,false", "ALL_DAY,true"})
    void createsMissingBlockUsingRegistrationRules(String previousKind, boolean existingTable) throws Exception {
        int eventId = register(previousKind.equals("DATED") ? timed("2026-11-02") : allDay());
        jdbcTemplate.update("DELETE FROM time_blocks");
        if (!existingTable) {
            jdbcTemplate.update("DELETE FROM time_tables");
        } else if (previousKind.equals("ALL_DAY")) {
            jdbcTemplate.update("INSERT INTO time_tables (user_id,date) VALUES (?, '2026-11-02')", loginUser.getId());
        }
        var body = timed("2026-11-02");
        update(eventId, body);
        assertThat(block()).containsEntry("TITLE", "予定").containsEntry("STATUS", "PLACED")
                .containsEntry("COLOR", "#123456").containsEntry("WIDTH", 90)
                .containsEntry("START_AT", Time.valueOf("09:15:00"))
                .containsEntry("USER_ID", loginUser.getId())
                .containsEntry("SCHEDULE_ID", jdbcTemplate.queryForObject(
                        "SELECT schedule_id FROM calendar_event WHERE id=?", Integer.class, eventId));
        var table = jdbcTemplate.queryForMap("SELECT * FROM time_tables");
        assertThat(block()).containsEntry("TABLE_ID", table.get("ID"));
        assertThat(table).containsEntry("DATE", Date.valueOf("2026-11-02"));
    }

    @Test
    void changingToAllDayDeletesBlockAndTasksButKeepsEvent() throws Exception {
        int eventId = register(timed("2026-11-02"));
        var block = block();
        jdbcTemplate.update("INSERT INTO time_block_tasks (time_block_id,title) VALUES (?, '作業')", block.get("ID"));
        var tables = jdbcTemplate.queryForList("SELECT * FROM time_tables");
        update(eventId, allDay());
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEmpty();
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).isEmpty();
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables")).isEqualTo(tables);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", block.get("SCHEDULE_ID")))
                .containsEntry("KIND", "ALL_DAY");
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM calendar_event WHERE id=?", eventId))
                .containsEntry("SCHEDULE_ID", block.get("SCHEDULE_ID"));
    }

    @Test
    void updatingAllDayDoesNotCreateBlockOrTable() throws Exception {
        int eventId = register(allDay());
        update(eventId, allDay());
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEmpty();
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"DATED", "ALL_DAY", "CROSS_DAY"})
    void crossDayUpdateLeavesBlocksUntouched(String previousKind) throws Exception {
        var initial = previousKind.equals("ALL_DAY") ? allDay() : timed("2026-11-02");
        if (previousKind.equals("CROSS_DAY")) {
            initial.put("endAt", "2026-11-03T10:45:00");
        }
        int eventId = register(initial);
        var blocks = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        var tables = jdbcTemplate.queryForList("SELECT * FROM time_tables");
        var body = timed("2026-11-03");
        body.put("endAt", "2026-11-04T10:45:00");
        update(eventId, body);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(blocks);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables")).isEqualTo(tables);
        // 同日内に戻したら、欠落している場合も含めて同期する。
        update(eventId, timed("2026-11-05"));
        assertThat(block()).containsEntry("TITLE", "予定").containsEntry("WIDTH", 90);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_tables WHERE id=?", block().get("TABLE_ID")))
                .containsEntry("DATE", Date.valueOf("2026-11-05"));
    }

    private Map<String, Object> timed(String date) {
        return new LinkedHashMap<>(Map.of("kind", "DATED", "title", "予定", "startAt", date + "T09:15:00",
                "endAt", date + "T10:45:00", "color", "#123456", "memo", "メモ"));
    }

    private Map<String, Object> allDay() {
        return new LinkedHashMap<>(Map.of("kind", "ALL_DAY", "title", "終日", "startDate", "2026-11-02",
                "endDate", "2026-11-03", "color", "#654321"));
    }

    private int register(Map<String, Object> body) throws Exception {
        var result = performJsonAsUser(post("/api/scheduler/register"), body).andExpect(status().isCreated()).andReturn();
        return Integer.parseInt(result.getResponse().getContentAsString());
    }

    private void update(int eventId, Map<String, Object> body) throws Exception {
        body.put("id", eventId);
        performJsonAsUser(put("/api/scheduler/update"), body).andExpect(status().isNoContent());
    }

    private Map<String, Object> block() {
        return jdbcTemplate.queryForMap("SELECT * FROM time_blocks");
    }
}
