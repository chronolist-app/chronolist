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

    /** 他ユーザーのHOLDしかない場合も空配列を返す. */
    @Test
    void otherUsersHoldBlocksReturnEmptyList() throws Exception {
        int otherUser = createUser("other-user");
        task(block(otherUser, null, "HOLD", schedule(otherUser)), "他ユーザーの作業");
        performAsUser(get(BASE + "timeBlock/getHoldBlocks"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    /** HOLD一覧は自分のブロック・タスク・関連予定だけを返す. */
    @Test
    void getHoldBlocksExcludesOtherUsersData() throws Exception {
        int otherUser = createUser("other-user");
        task(block(otherUser, null, "HOLD", schedule(otherUser)), "他ユーザーの作業");
        int ownSchedule = schedule();
        int ownBlock = block(null, "HOLD", ownSchedule);
        int ownTask = task(ownBlock, "自分の作業");

        performAsUser(get(BASE + "timeBlock/getHoldBlocks"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(ownBlock))
                .andExpect(jsonPath("$[0].userId").value(loginUser.getId()))
                .andExpect(jsonPath("$[0].tasks.length()").value(1))
                .andExpect(jsonPath("$[0].tasks[0].id").value(ownTask))
                .andExpect(jsonPath("$[0].tasks[0].timeBlockId").value(ownBlock))
                .andExpect(jsonPath("$[0].relatedSchedule.id").value(ownSchedule))
                .andExpect(jsonPath("$[0].relatedSchedule.userId").value(loginUser.getId()));
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

    /** 自分の予定を関連付けて登録でき、予定自体は変更しない. */
    @Test
    void registerBlockWithOwnSchedule() throws Exception {
        int ownSchedule = schedule();
        var schedules = jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id");
        var body = blockBody(table("2026-10-12"), "PLACED");
        body.put("relatedSchedule", scheduleBody(ownSchedule));

        var result = performJsonAsUser(put(BASE + "timeBlock/register"), body)
                .andExpect(status().isCreated()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);

        assertThat(id).isPositive();
        assertBlock(id, body);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).hasSize(1);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id")).isEqualTo(schedules);
    }

    /** 他ユーザーまたは不存在のテーブル・予定を参照する登録・更新は404でDBを維持する. */
    @ParameterizedTest
    @CsvSource({
            "register, table, false", "register, table, true",
            "register, schedule, false", "register, schedule, true",
            "update, table, false", "update, table, true",
            "update, schedule, false", "update, schedule, true"
    })
    void invalidReferenceReturns404(String operation, String reference, boolean missing) throws Exception {
        int otherUser = createUser("other-user");
        int ownTable = table("2026-10-12");
        int ownSchedule = schedule();
        int ownBlock = block(ownTable, "PLACED", ownSchedule);
        task(ownBlock, "保持する作業");
        int otherTable = table(otherUser, "2026-10-12");
        int otherSchedule = schedule(otherUser);
        task(block(otherUser, otherTable, "PLACED", otherSchedule), "他ユーザーの作業");
        var body = blockBody(ownTable, "PLACED");
        body.put("relatedSchedule", scheduleBody(ownSchedule));
        if (operation.equals("update")) body.put("id", ownBlock);
        if (reference.equals("table")) {
            body.put("timeTableId", missing ? -1 : otherTable);
        } else {
            var schedule = scheduleBody(missing ? -1 : otherSchedule);
            schedule.put("userId", loginUser.getId());
            body.put("relatedSchedule", schedule);
        }
        var before = databaseState();

        performJsonAsUser(put(BASE + "timeBlock/" + operation), body)
                .andExpect(status().isNotFound()).andExpect(content().string(""));

        assertThat(databaseState()).isEqualTo(before);
    }

    /** 本文で所有者を偽装しても、自分のブロックの登録・更新は認証ユーザーを所有者とする. */
    @ParameterizedTest
    @ValueSource(strings = {"register", "update"})
    void ownBlockIgnoresUserIdInRequestBody(String operation) throws Exception {
        int otherUser = createUser("other-user");
        int ownTable = table("2026-10-12");
        int ownSchedule = schedule();
        var schedules = jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id");
        var body = blockBody(ownTable, "PLACED");
        body.put("userId", otherUser);
        var related = scheduleBody(ownSchedule);
        related.put("userId", otherUser);
        body.put("relatedSchedule", related);
        int id;
        if (operation.equals("register")) {
            var result = performJsonAsUser(put(BASE + "timeBlock/register"), body)
                    .andExpect(status().isCreated()).andReturn();
            id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        } else {
            id = block(ownTable, "PLACED", ownSchedule);
            body.put("id", id);
            performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());
        }
        assertThat(id).isPositive();
        assertBlock(id, body);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_blocks", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT user_id FROM schedule WHERE id=?", Integer.class, ownSchedule))
                .isEqualTo(loginUser.getId());
        if (operation.equals("register")) {
            assertThat(jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id")).isEqualTo(schedules);
        } else {
            assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", ownSchedule))
                    .containsEntry("TITLE", "更新予定")
                    .containsEntry("START_DATE", java.sql.Date.valueOf("2026-11-01"))
                    .containsEntry("END_DATE", java.sql.Date.valueOf("2026-11-02"));
        }
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

    /** 自分の別テーブル・別予定に移動でき、元の予定と子タスクを維持する. */
    @Test
    void updateBlockMovesToOwnTableAndSchedule() throws Exception {
        int originalSchedule = schedule();
        int id = block(table("2026-10-12"), "PLACED", originalSchedule);
        task(id, "保持する作業");
        int destinationTable = table("2026-10-13");
        int destinationSchedule = schedule();
        var original = jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", originalSchedule);
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id");
        var body = blockBody(destinationTable, "PLACED");
        body.put("id", id);
        body.put("relatedSchedule", scheduleBody(destinationSchedule));

        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());

        assertBlock(id, body);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", destinationSchedule))
                .containsEntry("TITLE", "更新予定").containsEntry("USER_ID", loginUser.getId())
                .containsEntry("START_DATE", java.sql.Date.valueOf("2026-11-01"))
                .containsEntry("END_DATE", java.sql.Date.valueOf("2026-11-02"));
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", originalSchedule)).isEqualTo(original);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id")).isEqualTo(tasks);
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
        task(id, "保持する作業");
        var schedules = jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id");
        var tasks = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id");
        var expected = new LinkedHashMap<>(row(id));
        expected.put("START_AT", Time.valueOf("16:00:00"));
        performJsonAsUser(put(BASE + "timeBlock/update/startAt"), Map.of("id", id, "startAt", "16:00:00"))
                .andExpect(status().isNoContent());
        assertThat(row(id)).isEqualTo(expected);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id")).isEqualTo(schedules);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id")).isEqualTo(tasks);
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
        int ownTable = table("2026-10-12");
        int ownSchedule = schedule();
        task(block(ownTable, "PLACED", ownSchedule), "保持");
        var body = mutationBody(operation, -1, ownTable, ownSchedule);
        var before = databaseState();
        performJsonAsUser(operation.equals("delete") ? delete(BASE + "timeBlock/delete") : put(BASE + "timeBlock/" + operation), body)
                .andExpect(status().isNotFound()).andExpect(content().string(""));
        assertThat(databaseState()).isEqualTo(before);
    }

    /** 他人のブロックは所有者を本文で偽装しても更新・開始時刻変更・削除できない. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "update/startAt", "delete"})
    void otherUsersBlockReturns404(String operation) throws Exception {
        int otherUser = createUser("other-user");
        int otherTable = table(otherUser, "2026-10-12");
        int otherSchedule = schedule(otherUser);
        int id = block(otherUser, otherTable, "PLACED", otherSchedule);
        task(id, "他ユーザーの作業");
        int ownTable = table("2026-10-12");
        int ownSchedule = schedule();
        task(block(ownTable, "PLACED", ownSchedule), "自分の作業");
        // 参照先は自分のリソースとし、参照先の所有者チェックだけで404になることを避ける.
        var body = mutationBody(operation, id, ownTable, ownSchedule);
        body.put("userId", loginUser.getId());
        if (body.get("relatedSchedule") != null) {
            var related = scheduleBody(ownSchedule);
            related.put("userId", loginUser.getId());
            body.put("relatedSchedule", related);
        }
        var before = databaseState();

        performJsonAsUser(operation.equals("delete") ? delete(BASE + "timeBlock/delete")
                : put(BASE + "timeBlock/" + operation), body)
                .andExpect(status().isNotFound()).andExpect(content().string(""));

        assertThat(databaseState()).isEqualTo(before);
    }

    /** 自分のブロックでも他人・不存在の関連予定を指定した削除は404で全データを維持する. */
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void deleteWithInvalidScheduleReturns404(boolean missing) throws Exception {
        int ownSchedule = schedule();
        int id = block(table("2026-10-12"), "PLACED", ownSchedule);
        task(id, "自分の作業");
        int otherUser = createUser("other-user");
        int otherSchedule = schedule(otherUser);
        task(block(otherUser, null, "HOLD", otherSchedule), "他ユーザーの作業");
        var related = new LinkedHashMap<String, Object>();
        related.put("id", missing ? -1 : otherSchedule);
        related.put("userId", loginUser.getId());
        var before = databaseState();

        performJsonAsUser(delete(BASE + "timeBlock/delete"), Map.of("id", id, "relatedSchedule", related))
                .andExpect(status().isNotFound()).andExpect(content().string(""));

        assertThat(databaseState()).isEqualTo(before);
    }

    /** 操作ごとにID以外の必須項目を満たす本文を作る. */
    private Map<String, Object> mutationBody(String operation, int id, int tableId, int scheduleId) {
        Map<String, Object> body = operation.equals("update") ? blockBody(tableId, "PLACED") : new LinkedHashMap<>();
        body.put("id", id);
        if (operation.equals("update/startAt")) {
            body.put("startAt", "16:00:00");
        } else {
            body.put("relatedSchedule", operation.equals("delete") ? Map.of("id", scheduleId) : scheduleBody(scheduleId));
        }
        return body;
    }

    /** 更新可能な項目を揃えた関連予定の本文を作る. */
    private Map<String, Object> scheduleBody(int id) {
        return new LinkedHashMap<>(Map.of("id", id, "kind", "ALL_DAY", "startDate", "2026-11-01",
                "endDate", "2026-11-02", "title", "更新予定"));
    }

    /** 副作用を検出するため、関連テーブルをID順で取得する. */
    private Map<String, List<Map<String, Object>>> databaseState() {
        return Map.of(
                "tables", jdbcTemplate.queryForList("SELECT * FROM time_tables ORDER BY id"),
                "blocks", jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id"),
                "tasks", jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id"),
                "schedules", jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id"),
                "events", jdbcTemplate.queryForList("SELECT * FROM calendar_event ORDER BY id"));
    }

    /** 保存項目を独立したSQLで確認する. */
    private void assertBlock(int id, Map<String, Object> body) {
        Integer scheduleId = body.get("relatedSchedule") == null ? null
                : (Integer) ((Map<?, ?>) body.get("relatedSchedule")).get("id");
        assertThat(row(id)).containsEntry("USER_ID", loginUser.getId()).containsEntry("TABLE_ID", body.get("timeTableId"))
                .containsEntry("TITLE", body.get("title")).containsEntry("STATUS", body.get("status"))
                .containsEntry("WIDTH", body.get("width")).containsEntry("COLOR", body.get("color"))
                .containsEntry("START_AT", body.get("startAt") == null ? null : Time.valueOf((String) body.get("startAt")))
                .containsEntry("SCHEDULE_ID", scheduleId);
    }

    /** ブロック行を取得する. */
    private Map<String, Object> row(int id) {
        return jdbcTemplate.queryForMap("SELECT * FROM time_blocks WHERE id=?", id);
    }
}
