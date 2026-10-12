package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.sql.Time;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** ブロックの取得・登録・更新・削除と関連データを検証する. */
class TimeBlockApiTests extends TimeBlockingApiTest {
    /** HOLDブロックがない場合は空配列を返す. */
    @Test
    void emptyHoldList() throws Exception {
        block(table("2026-10-12"), "PLACED", null);
        performAsUser(get(BASE + "timeBlock/getHoldBlocks")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    /** HOLDのみを取得し、複数タスクでも親ブロックが重複しない. */
    @Test
    void getHoldBlocksIncludesTasks() throws Exception {
        int block = block(null, "HOLD", null);
        int first = task(block, "作業1");
        int second = task(block, "作業2");
        block(table("2026-10-12"), "PLACED", null);
        var result = performAsUser(get(BASE + "timeBlock/getHoldBlocks"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(block))
                .andExpect(jsonPath("$[0].title").value("ブロック"))
                .andExpect(jsonPath("$[0].status").value("HOLD"))
                .andExpect(jsonPath("$[0].width").value(60))
                .andExpect(jsonPath("$[0].color").value("#ff0000"))
                .andExpect(jsonPath("$[0].tasks.length()").value(2)).andReturn();
        var tasks = objectMapper.readTree(result.getResponse().getContentAsByteArray()).get(0).get("tasks");
        Map<Integer, String> titles = new LinkedHashMap<>();
        tasks.forEach(task -> {
            assertThat(task.get("timeBlockId").asInt()).isEqualTo(block);
            titles.put(task.get("id").asInt(), task.get("title").asText());
        });
        assertThat(titles).containsExactlyInAnyOrderEntriesOf(Map.of(first, "作業1", second, "作業2"));
    }

    /** 配置・保持の両形式を登録できる. */
    @ParameterizedTest
    @ValueSource(strings = {"HOLD", "PLACED"})
    void registerBlock(String status) throws Exception {
        Integer table = status.equals("HOLD") ? null : table("2026-10-12");
        var body = blockBody(table, status);
        var result = performJsonAsUser(put(BASE + "timeBlock/register"), body)
                .andExpect(status().isCreated()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertThat(id).isPositive();
        assertBlock(id, body);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).hasSize(1);
    }

    /** ブロックの配置・保持状態を変更して、他のブロックを維持する. */
    @ParameterizedTest
    @ValueSource(strings = {"HOLD", "PLACED"})
    void updateBlock(String status) throws Exception {
        int table = table("2026-10-12");
        int id = block(status.equals("HOLD") ? table : null, status.equals("HOLD") ? "PLACED" : "HOLD", null);
        int other = block(null, "HOLD", null);
        var before = row(other);
        var body = blockBody(status.equals("HOLD") ? null : table, status);
        body.put("id", id);
        performJsonAsUser(put(BASE + "timeBlock/update"), body)
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertBlock(id, body);
        assertThat(row(other)).isEqualTo(before);
    }

    /** 関連する予定も全体更新で反映する. */
    @Test
    void updateRelatedSchedule() throws Exception {
        int schedule = schedule();
        int id = block(null, "HOLD", schedule);
        var body = blockBody(null, "HOLD");
        body.put("id", id);
        body.put("relatedSchedule", Map.of("id", schedule, "kind", "ALL_DAY", "startDate", "2026-11-01",
                "endDate", "2026-11-02", "title", "更新予定"));
        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());
        assertThat(row(id).get("SCHEDULE_ID")).isEqualTo(schedule);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", schedule))
                .containsEntry("TITLE", "更新予定").containsEntry("USER_ID", loginUser.getId())
                .containsEntry("START_DATE", java.sql.Date.valueOf("2026-11-01"))
                .containsEntry("END_DATE", java.sql.Date.valueOf("2026-11-02"));
    }

    /** 開始時刻だけを変更し、他のフィールドとタスクを保持する. */
    @Test
    void updateStartAtPreservesFields() throws Exception {
        int id = block(table("2026-10-12"), "PLACED", null);
        task(id, "保持");
        var expected = new LinkedHashMap<>(row(id));
        expected.put("START_AT", Time.valueOf("16:00:00"));
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks");
        performJsonAsUser(put(BASE + "timeBlock/update/startAt"), Map.of("id", id, "startAt", "16:00:00"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(row(id)).isEqualTo(expected);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).isEqualTo(tasks);
    }

    /** 関連予定付きでも開始時刻だけが変更されるべき. */
    @Test
    void updateStartAtPreservesScheduleLink() throws Exception {
        int schedule = schedule();
        int id = block(table("2026-10-12"), "PLACED", schedule);
        var expected = new LinkedHashMap<>(row(id));
        expected.put("START_AT", Time.valueOf("16:00:00"));
        performJsonAsUser(put(BASE + "timeBlock/update/startAt"), Map.of("id", id, "startAt", "16:00:00"))
                .andExpect(status().isNoContent());
        assertThat(row(id)).isEqualTo(expected);
    }

    /** 削除は子タスクを削除し、指定された関連予定も削除する. */
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void deleteBlockAndRelatedData(boolean linked) throws Exception {
        Integer schedule = linked ? schedule() : null;
        int table = table("2026-10-12");
        int id = block(table, "PLACED", schedule);
        task(id, "削除");
        int other = block(null, "HOLD", null);
        int remainingTask = task(other, "保持");
        var before = row(other);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", id);
        if (linked) body.put("relatedSchedule", Map.of("id", schedule));
        performJsonAsUser(delete(BASE + "timeBlock/delete"), body)
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).containsExactly(before);
        assertThat(jdbcTemplate.queryForList("SELECT id FROM time_block_tasks"))
                .containsExactly(Map.of("ID", remainingTask));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_tables WHERE id=?", Integer.class, table)).isEqualTo(1);
        if (linked) assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM schedule WHERE id=?", Integer.class, schedule)).isZero();
    }

    /** 未登録IDの変更は404で既存データを保持する. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "update/startAt", "delete"})
    void missingBlockReturns404(String operation) throws Exception {
        task(block(null, "HOLD", null), "保持");
        var before = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks");
        performJsonAsUser(operation.equals("delete") ? delete(BASE + "timeBlock/delete") : put(BASE + "timeBlock/" + operation), Map.of("id", -1))
                .andExpect(status().isNotFound()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(before);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).isEqualTo(tasks);
    }

    /** 保存項目を独立したSQLで確認する. */
    private void assertBlock(int id, Map<String, Object> body) {
        assertThat(row(id)).containsEntry("USER_ID", loginUser.getId()).containsEntry("TABLE_ID", body.get("timeTableId"))
                .containsEntry("TITLE", body.get("title")).containsEntry("STATUS", body.get("status"))
                .containsEntry("WIDTH", body.get("width")).containsEntry("COLOR", body.get("color"))
                .containsEntry("START_AT", body.get("startAt") == null ? null : Time.valueOf((String) body.get("startAt")))
                .containsEntry("SCHEDULE_ID", null);
    }

    /** ブロック行を取得する. */
    private Map<String, Object> row(int id) {
        return jdbcTemplate.queryForMap("SELECT * FROM time_blocks WHERE id=?", id);
    }
}
