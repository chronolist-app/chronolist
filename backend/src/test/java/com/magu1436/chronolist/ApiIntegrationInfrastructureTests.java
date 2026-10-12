package com.magu1436.chronolist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.RepeatedTest;

import com.magu1436.chronolist.support.ApiIntegrationTest;

/** 実APIへのアクセス・永続化・テスト間のデータ初期化を確認する. */
class ApiIntegrationInfrastructureTests extends ApiIntegrationTest {

    /** 同じテストを繰り返し、前回の登録データが次回に残らないことも検証する. */
    @RepeatedTest(2)
    void requestsReachDatabaseAndEachTestStartsClean() throws Exception {
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isEqualTo(1);
        performAsUser(get("/api/todolist/getAll"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        var result = performJsonAsUser(post("/api/todolist/register"), Map.of(
                "title", "統合テスト", "priority", "MIDDLE", "dueKind", "NONE"))
                .andExpect(status().isOk())
                .andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);

        assertThat(jdbcTemplate.queryForObject("SELECT user_id FROM todo_tasks WHERE id = ?",
                Integer.class, id)).isEqualTo(loginUser.getId());
        assertThat(jdbcTemplate.queryForObject("SELECT title FROM todo_tasks WHERE id = ?",
                String.class, id)).isEqualTo("統合テスト");
        performAsUser(get("/api/todolist/getAll"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].title").value("統合テスト"));
    }
}
