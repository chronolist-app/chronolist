package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
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
        task(block(null, "HOLD", null), "保持");
        var before = jdbcTemplate.queryForList("SELECT * FROM time_block_tasks");
        performJsonAsUser(operation.equals("update") ? put(BASE + "timeBlockTask/update") : delete(BASE + "timeBlockTask/delete"), Map.of("id", -1))
                .andExpect(status().isNotFound()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_block_tasks")).isEqualTo(before);
    }
}
