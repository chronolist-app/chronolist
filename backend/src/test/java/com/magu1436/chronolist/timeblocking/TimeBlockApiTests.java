package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.sql.Time;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

    /** タスク件数の異なるHOLDを混在させても親子と所有者を分離する. */
    @Test
    void getHoldBlocksSeparatesBlocksAndTasks() throws Exception {
        int empty = block(null, "HOLD", null);
        int single = block(null, "HOLD", null);
        int one = task(single, "単独");
        int multiple = block(null, "HOLD", null);
        int first = task(multiple, "複数1");
        int second = task(multiple, "複数2");
        task(block(table("2026-10-12"), "PLACED", null), "配置済み");
        jdbcTemplate.update("INSERT INTO users (login_id,password,role) VALUES (?,?,?)",
                "other-user", "unused", "GENERAL");
        int otherUser = jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE login_id='other-user'", Integer.class);
        int other = block(null, "HOLD", null);
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

    /** 予定側の古い値に依存せず、移動先の日付・時刻・幅から日時を計算する（日跨ぎを含む）. */
    @ParameterizedTest
    @CsvSource({"15:00:00, 2026-11-01 16:30:00", "23:30:00, 2026-11-02 01:00:00"})
    void updateRelatedSchedule(String startAt, String endAt) throws Exception {
        int originalTable = table("2026-10-12");
        int table = table("2026-11-01");
        jdbcTemplate.update("""
                INSERT INTO schedule (user_id,kind,start_at,end_at,title)
                VALUES (?,'DATED','2026-10-12 09:30:00','2026-10-12 10:30:00','ブロック')
                """, loginUser.getId());
        int schedule = jdbcTemplate.queryForObject("SELECT MAX(id) FROM schedule", Integer.class);
        int id = block(originalTable, "PLACED", schedule);
        var body = blockBody(table, "PLACED");
        body.put("id", id);
        body.put("startAt", startAt);
        body.put("relatedSchedule", Map.of("id", schedule, "kind", "DATED",
                "startAt", "2026-10-12T09:30:00", "endAt", "2026-10-12T10:30:00",
                "title", "同期前の予定"));
        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());
        assertThat(row(id)).containsEntry("SCHEDULE_ID", schedule)
                .containsEntry("TITLE", "変更後のブロック")
                .containsEntry("TABLE_ID", table)
                .containsEntry("START_AT", Time.valueOf(startAt))
                .containsEntry("WIDTH", 90);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", schedule))
                .containsEntry("KIND", "DATED")
                .containsEntry("TITLE", "変更後のブロック")
                .containsEntry("USER_ID", loginUser.getId())
                .containsEntry("START_AT", Timestamp.valueOf("2026-11-01 " + startAt))
                .containsEntry("END_AT", Timestamp.valueOf(endAt))
                .containsEntry("START_DATE", null)
                .containsEntry("END_DATE", null);
    }

    /** 関連予定付きブロックをHOLDへ戻しても、予定の日時と関連付けを保持する. */
    @Test
    void moveLinkedBlockToHoldPreservesScheduleTimes() throws Exception {
        int table = table("2026-10-12");
        jdbcTemplate.update("""
                INSERT INTO schedule (user_id,kind,start_at,end_at,title)
                VALUES (?,'DATED','2026-10-12 09:30:00','2026-10-12 10:30:00','ブロック')
                """, loginUser.getId());
        int schedule = jdbcTemplate.queryForObject("SELECT MAX(id) FROM schedule", Integer.class);
        int id = block(table, "PLACED", schedule);
        var body = blockBody(null, "HOLD");
        body.put("id", id);
        body.put("relatedSchedule", Map.of("id", schedule, "kind", "DATED",
                "startAt", "2026-10-12T09:30:00", "endAt", "2026-10-12T10:30:00", "title", "ブロック"));

        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());

        assertThat(row(id)).containsEntry("STATUS", "HOLD").containsEntry("TABLE_ID", null)
                .containsEntry("START_AT", null).containsEntry("SCHEDULE_ID", schedule)
                .containsEntry("TITLE", "変更後のブロック");
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", schedule))
                .containsEntry("KIND", "DATED").containsEntry("TITLE", "変更後のブロック")
                .containsEntry("START_AT", Timestamp.valueOf("2026-10-12 09:30:00"))
                .containsEntry("END_AT", Timestamp.valueOf("2026-10-12 10:30:00"))
                .containsEntry("START_DATE", null).containsEntry("END_DATE", null);
    }

    /** HOLD・PLACEDのどちらでも終日予定の日付更新を維持し、時刻を設定しない. */
    @ParameterizedTest
    @ValueSource(strings = {"HOLD", "PLACED"})
    void updateRelatedAllDaySchedule(String status) throws Exception {
        int schedule = schedule();
        Integer table = status.equals("HOLD") ? null : table("2026-10-12");
        int id = block(table, status, schedule);
        var body = blockBody(table, status);
        body.put("id", id);
        body.put("relatedSchedule", Map.of("id", schedule, "kind", "ALL_DAY",
                "startDate", "2026-11-01", "endDate", "2026-11-02", "title", "同期前の予定"));

        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());

        assertThat(row(id)).containsEntry("STATUS", status).containsEntry("TABLE_ID", table)
                .containsEntry("START_AT", status.equals("HOLD") ? null : Time.valueOf("15:00:00"))
                .containsEntry("TITLE", "変更後のブロック").containsEntry("SCHEDULE_ID", schedule);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", schedule))
                .containsEntry("KIND", "ALL_DAY").containsEntry("TITLE", "変更後のブロック")
                .containsEntry("USER_ID", loginUser.getId())
                .containsEntry("START_DATE", java.sql.Date.valueOf("2026-11-01"))
                .containsEntry("END_DATE", java.sql.Date.valueOf("2026-11-02"))
                .containsEntry("START_AT", null).containsEntry("END_AT", null);
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
