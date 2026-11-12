package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** タイムテーブルの作成・日付検索・重複を検証する. */
class TimeTableApiTests extends TimeBlockingApiTest {
    /** 作成時にIDと所有者・日付が保存され、空のブロック一覧を返す. */
    @Test
    void createAndGetEmptyTable() throws Exception {
        var result = performJsonAsUser(post(BASE + "timeTable/createAt"), Map.of("date", "2026-10-12"))
                .andExpect(status().isCreated()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertThat(id).isPositive();
        assertThat(jdbcTemplate.queryForObject("SELECT user_id FROM time_tables WHERE id=?", Integer.class, id))
                .isEqualTo(loginUser.getId());
        assertThat(jdbcTemplate.queryForObject("SELECT CAST(date AS VARCHAR) FROM time_tables WHERE id=?", String.class, id))
                .isEqualTo("2026-10-12");
        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.userId").value(loginUser.getId()))
                .andExpect(jsonPath("$.date").value("2026-10-12"))
                .andExpect(jsonPath("$.timeBlocks").isEmpty());
    }

    /** 指定日のブロックのみを含める. */
    @Test
    void getTableIncludesItsBlocks() throws Exception {
        int table = table("2026-10-12");
        seedCalendarEvent("2026-10-12");
        int block = block(table, "PLACED");
        int task = task(block, "作業");
        int held = block(table, "HOLD");
        block(table, "HOLD");
        block(table("2026-10-13"), "PLACED");
        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(table))
                .andExpect(jsonPath("$.timeBlocks.length()").value(1))
                .andExpect(jsonPath("$.timeBlocks[0].id").value(block))
                .andExpect(jsonPath("$.timeBlocks[0].timeTableId").value(table))
                .andExpect(jsonPath("$.timeBlocks[0].title").value("ブロック"))
                .andExpect(jsonPath("$.timeBlocks[0].status").value("PLACED"))
                .andExpect(jsonPath("$.timeBlocks[0].width").value(60))
                .andExpect(jsonPath("$.timeBlocks[0].startAt").value("09:30:00"))
                .andExpect(jsonPath("$.timeBlocks[0].color").value("#ff0000"))
                .andExpect(jsonPath("$.timeBlocks[0].tasks[0].id").value(task))
                .andExpect(jsonPath("$.timeBlocks[0].relatedSchedule").doesNotHaveJsonPath());
        performAsUser(get(BASE + "timeBlock/getHoldBlocks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.id == " + held + ")]").isNotEmpty());
    }

    /** 配置済みブロックにAPIで追加したタスクを日付検索で復元する. */
    @Test
    void getTableRestoresRegisteredTask() throws Exception {
        int table = table("2026-10-12");
        int block = block(table, "PLACED");
        var result = performJsonAsUser(put(BASE + "timeBlockTask/register"),
                Map.of("timeBlockId", block, "title", "保存した作業"))
                .andExpect(status().isCreated()).andReturn();
        int task = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertThat(task).isPositive();
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_block_tasks WHERE id=?", task))
                .containsEntry("TIME_BLOCK_ID", block).containsEntry("TITLE", "保存した作業");

        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeBlocks.length()").value(1))
                .andExpect(jsonPath("$.timeBlocks[0].id").value(block))
                .andExpect(jsonPath("$.timeBlocks[0].tasks.length()").value(1))
                .andExpect(jsonPath("$.timeBlocks[0].tasks[0].id").value(task))
                .andExpect(jsonPath("$.timeBlocks[0].tasks[0].title").value("保存した作業"))
                .andExpect(jsonPath("$.timeBlocks[0].tasks[0].timeBlockId").value(block));
    }

    /** タスク件数の異なる配置済みブロックの親子を分離し、別日・HOLD・他ユーザーを除外する. */
    @Test
    void getTableSeparatesBlocksAndTasks() throws Exception {
        int table = table("2026-10-12");
        int empty = block(table, "PLACED");
        int single = block(table, "PLACED");
        int one = task(single, "単独");
        int multiple = block(table, "PLACED");
        int first = task(multiple, "複数1");
        int second = task(multiple, "複数2");
        task(block(table("2026-10-13"), "PLACED"), "別日");
        task(block(table, "HOLD"), "保持中");
        task(block(null, "HOLD"), "未配置");
        jdbcTemplate.update("INSERT INTO users (login_id,password,role) VALUES (?,?,?)",
                "other-user", "unused", "GENERAL");
        int otherUser = jdbcTemplate.queryForObject("SELECT id FROM users WHERE login_id=?", Integer.class, "other-user");
        // テーブルとブロックの所有者を意図的に不整合にし、他ユーザーのブロックとタスクが返らないことを確認する。
        int foreign = block(table, "PLACED");
        task(foreign, "他ユーザー");
        jdbcTemplate.update("UPDATE time_blocks SET user_id=? WHERE id=?", otherUser, foreign);
        jdbcTemplate.update("INSERT INTO time_tables (user_id,date) VALUES (?,?)", otherUser, "2026-10-12");
        int foreignTable = jdbcTemplate.queryForObject("SELECT id FROM time_tables WHERE user_id=?", Integer.class, otherUser);
        int foreignTableBlock = block(foreignTable, "PLACED");
        task(foreignTableBlock, "他ユーザーの同日テーブル");
        jdbcTemplate.update("UPDATE time_blocks SET user_id=? WHERE id=?", otherUser, foreignTableBlock);

        var result = performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(table))
                .andExpect(jsonPath("$.userId").value(loginUser.getId())).andReturn();
        var blocks = objectMapper.readTree(result.getResponse().getContentAsByteArray()).get("timeBlocks");
        assertThat(blocks.size()).isEqualTo(3);
        Map<Integer, Map<Integer, String>> actual = new LinkedHashMap<>();
        blocks.forEach(b -> {
            int id = b.get("id").asInt();
            assertThat(b.get("timeTableId").asInt()).isEqualTo(table);
            assertThat(b.get("userId").asInt()).isEqualTo(loginUser.getId());
            assertThat(b.get("status").asText()).isEqualTo("PLACED");
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

    /** 未作成の日は404を返す. */
    @Test
    void missingDateReturns404() throws Exception {
        table("2026-10-13");
        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isNotFound()).andExpect(content().string(""));
    }

    /** 同日の再作成は409で既存データを維持する. */
    @Test
    void duplicateDateReturns409() throws Exception {
        int table = table("2026-10-12");
        block(table, "PLACED");
        var before = jdbcTemplate.queryForList("SELECT * FROM time_tables");
        var blocks = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        performJsonAsUser(post(BASE + "timeTable/createAt"), Map.of("date", "2026-10-12"))
                .andExpect(status().isConflict()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables")).isEqualTo(before);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(blocks);
    }
}
