package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

/** タイムテーブルの作成・日付検索・重複と所有者による分離を検証する. */
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
        int block = block(table, "PLACED", null);
        block(table("2026-10-13"), "PLACED", null);
        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(table))
                .andExpect(jsonPath("$.timeBlocks.length()").value(1))
                .andExpect(jsonPath("$.timeBlocks[0].id").value(block))
                .andExpect(jsonPath("$.timeBlocks[0].timeTableId").value(table))
                .andExpect(jsonPath("$.timeBlocks[0].title").value("ブロック"))
                .andExpect(jsonPath("$.timeBlocks[0].status").value("PLACED"))
                .andExpect(jsonPath("$.timeBlocks[0].width").value(60))
                .andExpect(jsonPath("$.timeBlocks[0].startAt").value("09:30:00"))
                .andExpect(jsonPath("$.timeBlocks[0].color").value("#ff0000"));
    }

    /** 未作成の日は404を返す. */
    @Test
    void missingDateReturns404() throws Exception {
        table("2026-10-13");
        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isNotFound()).andExpect(content().string(""));
    }

    /** 他ユーザーだけが持つ日付は404で、テーブルとブロックを変更しない. */
    @Test
    void otherUsersDateReturns404() throws Exception {
        int otherUser = createUser("other-user");
        int otherTable = table(otherUser, "2026-10-12");
        block(otherUser, otherTable, "PLACED", null);
        var tables = jdbcTemplate.queryForList("SELECT * FROM time_tables ORDER BY id");
        var blocks = jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id");

        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isNotFound()).andExpect(content().string(""));

        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables ORDER BY id")).isEqualTo(tables);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id")).isEqualTo(blocks);
    }

    /** 同日のテーブルが両ユーザーにあっても、自分のテーブルとブロックだけを返す. */
    @Test
    void getSameDateReturnsOnlyOwnTableAndBlocks() throws Exception {
        int otherUser = createUser("other-user");
        int otherTable = table(otherUser, "2026-10-12");
        block(otherUser, otherTable, "PLACED", null);
        int ownTable = table("2026-10-12");
        int ownBlock = block(ownTable, "PLACED", null);

        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(ownTable))
                .andExpect(jsonPath("$.userId").value(loginUser.getId()))
                .andExpect(jsonPath("$.date").value("2026-10-12"))
                .andExpect(jsonPath("$.timeBlocks.length()").value(1))
                .andExpect(jsonPath("$.timeBlocks[0].id").value(ownBlock))
                .andExpect(jsonPath("$.timeBlocks[0].userId").value(loginUser.getId()))
                .andExpect(jsonPath("$.timeBlocks[0].timeTableId").value(ownTable));
    }

    /** 他ユーザーが同日のテーブルを持っていても、自分のテーブルを作成できる. */
    @Test
    void createSameDateAsOtherUser() throws Exception {
        int otherUser = createUser("other-user");
        int otherTable = table(otherUser, "2026-10-12");
        var before = jdbcTemplate.queryForMap("SELECT * FROM time_tables WHERE id=?", otherTable);

        var result = performJsonAsUser(post(BASE + "timeTable/createAt"), Map.of("date", "2026-10-12"))
                .andExpect(status().isCreated()).andReturn();
        int ownTable = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);

        assertThat(ownTable).isPositive().isNotEqualTo(otherTable);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_tables WHERE id=?", ownTable))
                .containsEntry("USER_ID", loginUser.getId())
                .containsEntry("DATE", java.sql.Date.valueOf("2026-10-12"));
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_tables WHERE id=?", otherTable)).isEqualTo(before);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_tables", Integer.class)).isEqualTo(2);
    }

    /** 本文のuserIdを偽装しても、認証ユーザーを所有者として保存する. */
    @Test
    void createIgnoresUserIdInRequestBody() throws Exception {
        int otherUser = createUser("other-user");

        var result = performJsonAsUser(post(BASE + "timeTable/createAt"),
                Map.of("date", "2026-10-12", "userId", otherUser))
                .andExpect(status().isCreated()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);

        assertThat(id).isPositive();
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_tables WHERE id=?", id))
                .containsEntry("USER_ID", loginUser.getId())
                .containsEntry("DATE", java.sql.Date.valueOf("2026-10-12"));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_tables", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM time_tables WHERE user_id=?",
                Integer.class, otherUser)).isZero();
    }

    /** 自分のテーブルに紐づいた他ユーザー所有のブロックは取得結果から除外する. */
    @Test
    void getTableExcludesOtherUsersBlockLinkedToOwnTable() throws Exception {
        int otherUser = createUser("other-user");
        int ownTable = table("2026-10-12");
        int ownBlock = block(ownTable, "PLACED", null);
        block(otherUser, ownTable, "PLACED", null);
        var before = jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id");

        performAsUser(get(BASE + "timeTable/getByDate/2026-10-12"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(ownTable))
                .andExpect(jsonPath("$.userId").value(loginUser.getId()))
                .andExpect(jsonPath("$.timeBlocks.length()").value(1))
                .andExpect(jsonPath("$.timeBlocks[0].id").value(ownBlock))
                .andExpect(jsonPath("$.timeBlocks[0].userId").value(loginUser.getId()))
                .andExpect(jsonPath("$.timeBlocks[0].timeTableId").value(ownTable));

        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id")).isEqualTo(before);
    }

    /** 同日の再作成は409で既存データを維持する. */
    @Test
    void duplicateDateReturns409() throws Exception {
        int table = table("2026-10-12");
        block(table, "PLACED", null);
        var before = jdbcTemplate.queryForList("SELECT * FROM time_tables");
        var blocks = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        performJsonAsUser(post(BASE + "timeTable/createAt"), Map.of("date", "2026-10-12"))
                .andExpect(status().isConflict()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables")).isEqualTo(before);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(blocks);
    }
}
