package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** テンプレートのCRUDを検証する. */
class TemplateBlockApiTests extends TimeBlockingApiTest {
    /** テンプレートがない場合は空配列を返す. */
    @Test
    void emptyList() throws Exception {
        performAsUser(get(BASE + "templateBlock/getAll")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    /** 登録された項目とIDを一覧取得できる. */
    @Test
    void registerAndGetAll() throws Exception {
        var result = performJsonAsUser(put(BASE + "templateBlock/register"),
                Map.of("title", "読書", "width", 45, "color", "#123456"))
                .andExpect(status().isCreated()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertThat(id).isPositive();
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM template_blocks WHERE id=?", id))
                .containsEntry("USER_ID", loginUser.getId()).containsEntry("TITLE", "読書")
                .containsEntry("WIDTH", 45).containsEntry("COLOR", "#123456");
        performAsUser(get(BASE + "templateBlock/getAll")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].title").value("読書")).andExpect(jsonPath("$[0].width").value(45))
                .andExpect(jsonPath("$[0].color").value("#123456"));
    }

    /** 更新・削除の対象外のテンプレートを維持する. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void mutateOnlySelectedTemplate(String operation) throws Exception {
        int id = template();
        int other = template();
        var untouched = jdbcTemplate.queryForMap("SELECT * FROM template_blocks WHERE id=?", other);
        var body = Map.of("id", id, "title", "変更", "width", 60, "color", "#abcdef");
        performJsonAsUser(operation.equals("update") ? put(BASE + "templateBlock/update") : delete(BASE + "templateBlock/delete"), body)
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM template_blocks WHERE id=?", other)).isEqualTo(untouched);
        if (operation.equals("update")) {
            assertThat(jdbcTemplate.queryForMap("SELECT * FROM template_blocks WHERE id=?", id))
                    .containsEntry("USER_ID", loginUser.getId()).containsEntry("TITLE", "変更")
                    .containsEntry("WIDTH", 60).containsEntry("COLOR", "#abcdef");
        } else {
            assertThat(jdbcTemplate.queryForList("SELECT * FROM template_blocks")).containsExactly(untouched);
        }
    }

    /** 存在しないIDの更新・削除は404でDBを変更しない. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void missingTemplateReturns404(String operation) throws Exception {
        template();
        var before = jdbcTemplate.queryForList("SELECT * FROM template_blocks");
        performJsonAsUser(operation.equals("update") ? put(BASE + "templateBlock/update") : delete(BASE + "templateBlock/delete"), Map.of("id", -1))
                .andExpect(status().isNotFound()).andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM template_blocks")).isEqualTo(before);
    }
}
