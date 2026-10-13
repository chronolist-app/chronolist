package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** ブロックタスクの登録・更新・削除を検証する. */
class TimeBlockTaskApiTests extends TimeBlockingApiTest {
    /** 親ブロックを維持してタスクを登録する. */
    @Test
    void registerTask() throws Exception {
        int block = block(null, "HOLD", null);
        var parent = jdbcTemplate.queryForMap("SELECT * FROM time_blocks WHERE id=?", block);
        var result = performJsonAsUser(put(BASE + "timeBlockTask/register"), Map.of("timeBlockId", block, "title", "作業"))
                .andExpect(status().isCreated()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertThat(id).isPositive();
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).hasSize(1);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_block_tasks WHERE id=?", id))
                .containsEntry("TIME_BLOCK_ID", block).containsEntry("TITLE", "作業");
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_blocks WHERE id=?", block)).isEqualTo(parent);
    }

    /** 名称と親ブロックを更新でき、他のタスクを維持する. */
    @Test
    void updateTask() throws Exception {
        int first = block(null, "HOLD", null);
        int second = block(null, "HOLD", null);
        int id = task(first, "元の作業");
        int other = task(first, "別の作業");
        var untouched = jdbcTemplate.queryForMap("SELECT * FROM time_block_tasks WHERE id=?", other);
        var parents = jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id");
        performJsonAsUser(put(BASE + "timeBlockTask/update"), Map.of("id", id, "timeBlockId", second, "title", "変更後の作業"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_block_tasks WHERE id=?", id))
                .containsEntry("TIME_BLOCK_ID", second).containsEntry("TITLE", "変更後の作業");
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_block_tasks WHERE id=?", other)).isEqualTo(untouched);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id")).isEqualTo(parents);
    }

    /** 削除は親ブロックと他のタスクを維持する. */
    @Test
    void deleteTask() throws Exception {
        int block = block(null, "HOLD", null);
        int id = task(block, "削除");
        int other = task(block, "保持");
        var untouched = jdbcTemplate.queryForMap("SELECT * FROM time_block_tasks WHERE id=?", other);
        var parent = jdbcTemplate.queryForMap("SELECT * FROM time_blocks WHERE id=?", block);
        performJsonAsUser(delete(BASE + "timeBlockTask/delete"), Map.of("id", id))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).containsExactly(untouched);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM time_blocks WHERE id=?", block)).isEqualTo(parent);
    }

    /** 未登録のIDは404でDBを変更しない. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void missingTaskReturns404(String operation) throws Exception {
        int ownBlock = block(null, "HOLD", null);
        task(ownBlock, "保持");
        assertNotFoundWithoutChanges(
                operation.equals("update") ? put(BASE + "timeBlockTask/update") : delete(BASE + "timeBlockTask/delete"),
                operation.equals("update")
                        ? Map.of("id", -1, "timeBlockId", ownBlock, "title", "変更後の作業")
                        : Map.of("id", -1));
    }

    /** 他ユーザー所有または不存在の親ブロックには登録できない. */
    @ParameterizedTest
    @ValueSource(strings = {"foreign", "missing"})
    void registerTaskRejectsUnavailableBlock(String destination) throws Exception {
        int ownBlock = block(null, "HOLD", null);
        int foreignBlock = foreignBlock();
        task(ownBlock, "自分の作業");
        task(foreignBlock, "他ユーザーの作業");
        assertNotFoundWithoutChanges(put(BASE + "timeBlockTask/register"),
                Map.of("timeBlockId", destination.equals("foreign") ? foreignBlock : -1, "title", "追加する作業"));
    }

    /** 更新元と更新先の両方が認証ユーザー所有でなければ更新できない. */
    @ParameterizedTest
    @ValueSource(strings = {"foreignToForeign", "foreignToOwn", "ownToForeign"})
    void updateTaskRejectsForeignOwnership(String transition) throws Exception {
        int ownBlock = block(null, "HOLD", null);
        int foreignBlock = foreignBlock();
        int ownTask = task(ownBlock, "自分の作業");
        int foreignTask = task(foreignBlock, "他ユーザーの作業");
        int target = transition.equals("ownToForeign") ? ownTask : foreignTask;
        int destination = transition.equals("foreignToOwn") ? ownBlock : foreignBlock;
        assertNotFoundWithoutChanges(put(BASE + "timeBlockTask/update"),
                Map.of("id", target, "timeBlockId", destination, "title", "変更後の作業"));
    }

    /** 自分のタスクでも不存在の親ブロックへは移動できない. */
    @Test
    void updateTaskRejectsMissingDestination() throws Exception {
        int ownBlock = block(null, "HOLD", null);
        int id = task(ownBlock, "自分の作業");
        task(foreignBlock(), "他ユーザーの作業");
        assertNotFoundWithoutChanges(put(BASE + "timeBlockTask/update"),
                Map.of("id", id, "timeBlockId", -1, "title", "変更後の作業"));
    }

    /** 他ユーザーのタスクは削除できない. */
    @Test
    void deleteTaskRejectsForeignOwnership() throws Exception {
        task(block(null, "HOLD", null), "自分の作業");
        int id = task(foreignBlock(), "他ユーザーの作業");
        assertNotFoundWithoutChanges(delete(BASE + "timeBlockTask/delete"), Map.of("id", id));
    }

    /** APIを経由せず別ユーザーと、そのユーザー所有のHOLDブロックを作る. */
    private int foreignBlock() {
        String loginId = "time-block-task-other-user";
        jdbcTemplate.update("INSERT INTO users (login_id,password,role) VALUES (?,?,?)",
                loginId, "unused-test-password", "GENERAL");
        int userId = jdbcTemplate.queryForObject("SELECT id FROM users WHERE login_id=?", Integer.class, loginId);
        int id = block(null, "HOLD", null);
        jdbcTemplate.update("UPDATE time_blocks SET user_id=? WHERE id=?", userId, id);
        return id;
    }

    /** 拒否応答と、双方のユーザーの全タスク・親ブロックが不変であることを検証する. */
    private void assertNotFoundWithoutChanges(MockHttpServletRequestBuilder request, Object body) throws Exception {
        var tasksBefore = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id");
        var blocksBefore = jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id");
        performJsonAsUser(request, body).andExpect(status().isNotFound());
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks ORDER BY id")).isEqualTo(tasksBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks ORDER BY id")).isEqualTo(blocksBefore);
    }
}
