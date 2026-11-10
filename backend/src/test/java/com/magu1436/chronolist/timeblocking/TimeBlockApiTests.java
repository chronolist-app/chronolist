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
        block(table("2026-10-12"), "PLACED");
        performAsUser(get(BASE + "timeBlock/getHoldBlocks")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    /** HOLDのみを取得し、複数タスクでも親ブロックが重複しない. */
    @Test
    void getHoldBlocksIncludesTasks() throws Exception {
        int block = legacyLinkedBlock(null, "HOLD", scheduleWithCalendarEvent());
        int first = task(block, "作業1");
        int second = task(block, "作業2");
        block(table("2026-10-12"), "PLACED");
        var result = performAsUser(get(BASE + "timeBlock/getHoldBlocks"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(block))
                .andExpect(jsonPath("$[0].title").value("ブロック"))
                .andExpect(jsonPath("$[0].status").value("HOLD"))
                .andExpect(jsonPath("$[0].width").value(60))
                .andExpect(jsonPath("$[0].color").value("#ff0000"))
                .andExpect(jsonPath("$[0].relatedSchedule").doesNotHaveJsonPath())
                .andExpect(jsonPath("$[0].tasks.length()").value(2)).andReturn();
        var tasks = objectMapper.readTree(result.getResponse().getContentAsByteArray()).get(0).get("tasks");
        Map<Integer, String> titles = new LinkedHashMap<>();
        tasks.forEach(task -> {
            assertThat(task.get("timeBlockId").asInt()).isEqualTo(block);
            titles.put(task.get("id").asInt(), task.get("title").asText());
        });
        assertThat(titles).containsExactlyInAnyOrderEntriesOf(Map.of(first, "作業1", second, "作業2"));
    }

    /** タスク件数の異なるHOLDを混在させても親子と所有者を分離する. */
    @Test
    void getHoldBlocksSeparatesBlocksAndTasks() throws Exception {
        int empty = block(null, "HOLD");
        int single = block(null, "HOLD");
        int one = task(single, "単独");
        int multiple = block(null, "HOLD");
        int first = task(multiple, "複数1");
        int second = task(multiple, "複数2");
        task(block(table("2026-10-12"), "PLACED"), "配置済み");
        jdbcTemplate.update("INSERT INTO users (login_id,password,role) VALUES (?,?,?)",
                "other-user", "unused", "GENERAL");
        int otherUser = jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE login_id='other-user'", Integer.class);
        int other = block(null, "HOLD");
        task(other, "他ユーザー");
        jdbcTemplate.update("UPDATE time_blocks SET user_id=? WHERE id=?", otherUser, other);

        var result = performAsUser(get(BASE + "timeBlock/getHoldBlocks"))
                .andExpect(status().isOk()).andReturn();
        var blocks = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(blocks.size()).isEqualTo(3);
        Map<Integer, Map<Integer, String>> actual = new LinkedHashMap<>();
        blocks.forEach(b -> {
            int id = b.get("id").asInt();
            assertThat(b.get("status").asText()).isEqualTo("HOLD");
            assertThat(b.get("userId").asInt()).isEqualTo(loginUser.getId());
            assertThat(actual).doesNotContainKey(id);
            assertThat(b.get("tasks").isArray()).isTrue();
            Map<Integer, String> tasks = new LinkedHashMap<>();
            b.get("tasks").forEach(t -> {
                assertThat(t.get("timeBlockId").asInt()).isEqualTo(id);
                assertThat(tasks).doesNotContainKey(t.get("id").asInt());
                tasks.put(t.get("id").asInt(), t.get("title").asText());
            });
            actual.put(id, tasks);
        });
        assertThat(actual).containsExactlyInAnyOrderEntriesOf(Map.of(
                empty, Map.of(), single, Map.of(one, "単独"),
                multiple, Map.of(first, "複数1", second, "複数2")));
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
        int id = block(status.equals("HOLD") ? table : null, status.equals("HOLD") ? "PLACED" : "HOLD");
        int other = block(null, "HOLD");
        var before = row(other);
        var body = blockBody(status.equals("HOLD") ? null : table, status);
        body.put("id", id);
        performJsonAsUser(put(BASE + "timeBlock/update"), body)
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertBlock(id, body);
        assertThat(row(other)).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"startAt", "timeTableId"})
    void rejectsIncompletePlacement(String missingField) throws Exception {
        int table = table("2026-10-12");
        int id = block(table, "HOLD");
        var before = row(id);
        var body = blockBody(table, "PLACED");
        body.put(missingField, null);
        performJsonAsUser(put(BASE + "timeBlock/register"), body)
                .andExpect(status().isBadRequest());
        body.put("id", id);
        performJsonAsUser(put(BASE + "timeBlock/update"), body)
                .andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).containsExactly(before);
    }

    @Test
    void placedBlockCannotLoseItsStartTime() throws Exception {
        int id = block(table("2026-10-12"), "PLACED");
        var before = row(id);
        performJsonAsUser(put(BASE + "timeBlock/update/startAt"), Map.of("id", id))
                .andExpect(status().isBadRequest());
        assertThat(row(id)).isEqualTo(before);
    }

    /** 旧形式の予定情報を送っても、ブロックの登録で予定とイベントを変更しない. */
    @Test
    void registerIgnoresLegacySchedulePayload() throws Exception {
        int schedule = scheduleWithCalendarEvent();
        var before = calendarRows();
        var body = blockBody(table("2026-10-12"), "PLACED");
        body.put("relatedSchedule", legacySchedulePayload(schedule));

        var result = performJsonAsUser(put(BASE + "timeBlock/register"), body)
                .andExpect(status().isCreated()).andReturn();

        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertBlock(id, body);
        assertThat(row(id)).containsEntry("SCHEDULE_ID", null);
        assertThat(calendarRows()).isEqualTo(before);
    }

    /** 旧仕様で予定に紐づけられたブロックも、予定やタスクに影響せず更新できる. */
    @ParameterizedTest
    @ValueSource(strings = {"HOLD", "PLACED"})
    void updateLegacyLinkedBlockLeavesCalendarAndTasksUnchanged(String status) throws Exception {
        int schedule = scheduleWithCalendarEvent();
        int id = legacyLinkedBlock(table("2026-10-12"), "PLACED", schedule);
        task(id, "保持");
        var before = calendarRows();
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks WHERE time_block_id=?", id);
        var body = blockBody(status.equals("HOLD") ? null : table("2026-11-01"), status);
        body.put("id", id);
        body.put("relatedSchedule", legacySchedulePayload(schedule));

        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());

        assertBlock(id, body);
        assertThat(row(id)).containsEntry("SCHEDULE_ID", schedule);
        assertThat(calendarRows()).isEqualTo(before);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks WHERE time_block_id=?", id)).isEqualTo(tasks);
    }

    /** 開始時刻だけを変更し、他のフィールドとタスクを保持する. */
    @Test
    void updateStartAtPreservesFields() throws Exception {
        int id = block(table("2026-10-12"), "PLACED");
        task(id, "保持");
        var expected = new LinkedHashMap<>(row(id));
        expected.put("START_AT", Time.valueOf("16:00:00"));
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks");
        performJsonAsUser(put(BASE + "timeBlock/update/startAt"), Map.of("id", id, "startAt", "16:00:00"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(row(id)).isEqualTo(expected);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).isEqualTo(tasks);
    }

    /** 関連予定付きでも開始時刻だけを変更し、子タスクと関連予定の内容を保持する. */
    @Test
    void updateStartAtPreservesScheduleLink() throws Exception {
        int schedule = scheduleWithCalendarEvent();
        int id = legacyLinkedBlock(table("2026-10-12"), "PLACED", schedule);
        task(id, "保持");
        var expected = new LinkedHashMap<>(row(id));
        expected.put("START_AT", Time.valueOf("16:00:00"));
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks WHERE time_block_id=?", id);
        var before = calendarRows();
        performJsonAsUser(put(BASE + "timeBlock/update/startAt"), Map.of("id", id, "startAt", "16:00:00"))
                .andExpect(status().isNoContent());
        assertThat(row(id)).isEqualTo(expected);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks WHERE time_block_id=?", id)).isEqualTo(tasks);
        assertThat(calendarRows()).isEqualTo(before);
    }

    /** ブロックと子タスクを削除し、予定とカレンダーイベントを保持する. */
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void deleteBlockAndTasksLeavesCalendarUnchanged(boolean linked) throws Exception {
        int schedule = scheduleWithCalendarEvent();
        int table = table("2026-10-12");
        int id = linked ? legacyLinkedBlock(table, "PLACED", schedule) : block(table, "PLACED");
        task(id, "削除");
        int other = block(null, "HOLD");
        int remainingTask = task(other, "保持");
        var before = row(other);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", id);
        if (linked) body.put("relatedSchedule", legacySchedulePayload(schedule));
        var calendarBefore = calendarRows();
        performJsonAsUser(delete(BASE + "timeBlock/delete"), body)
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).containsExactly(before);
        assertThat(jdbcTemplate.queryForList("SELECT id FROM time_block_tasks"))
                .containsExactly(Map.of("ID", remainingTask));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_tables WHERE id=?", Integer.class, table)).isEqualTo(1);
        assertThat(calendarRows()).isEqualTo(calendarBefore);
    }

    /** 未登録IDの変更は404で既存データを保持する. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "update/startAt", "delete"})
    void missingBlockReturns404(String operation) throws Exception {
        task(block(null, "HOLD"), "保持");
        var before = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks");
        var body = operation.equals("update/startAt") ? Map.of("id", -1, "startAt", "09:30:00") : Map.of("id", -1);
        performJsonAsUser(operation.equals("delete") ? delete(BASE + "timeBlock/delete") : put(BASE + "timeBlock/" + operation), body)
                .andExpect(status().isNotFound()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(before);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).isEqualTo(tasks);
    }

    /** 保存項目を独立したSQLで確認する. */
    private void assertBlock(int id, Map<String, Object> body) {
        assertThat(row(id)).containsEntry("USER_ID", loginUser.getId()).containsEntry("TABLE_ID", body.get("timeTableId"))
                .containsEntry("TITLE", body.get("title")).containsEntry("STATUS", body.get("status"))
                .containsEntry("WIDTH", body.get("width")).containsEntry("COLOR", body.get("color"))
                .containsEntry("START_AT", body.get("startAt") == null ? null : Time.valueOf((String) body.get("startAt")));
    }

    /** 旧クライアントが送っていた予定情報を作る. */
    private Map<String, Object> legacySchedulePayload(int scheduleId) {
        return Map.of("id", scheduleId, "kind", "ALL_DAY", "title", "旧クライアントからの予定",
                "startDate", "2026-11-01", "endDate", "2026-11-02");
    }

    /** 予定とイベントの全項目を比較できる形で取得する. */
    private Map<String, List<Map<String, Object>>> calendarRows() {
        return Map.of(
                "schedule", jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id"),
                "calendar_event", jdbcTemplate.queryForList("""
                        SELECT id, schedule_id, color, CAST(memo AS VARCHAR) AS memo FROM calendar_event ORDER BY id
                        """));
    }

    /** ブロック行を取得する. */
    private Map<String, Object> row(int id) {
        return jdbcTemplate.queryForMap("SELECT * FROM time_blocks WHERE id=?", id);
    }
}
