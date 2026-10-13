package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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

    /** 自分と他ユーザーのテンプレートが混在していても自分のデータだけを返す. */
    @Test
    void getAllExcludesForeignTemplates() throws Exception {
        int own = template();
        foreignTemplate();
        var before = jdbcTemplate.queryForList("SELECT * FROM template_blocks ORDER BY id");
        performAsUser(get(BASE + "templateBlock/getAll"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(own))
                .andExpect(jsonPath("$[0].title").value("テンプレート"))
                .andExpect(jsonPath("$[0].width").value(30))
                .andExpect(jsonPath("$[0].color").value("#00ff00"));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM template_blocks ORDER BY id")).isEqualTo(before);
    }

    /** 他ユーザーのデータだけがあっても自分の一覧は空になる. */
    @Test
    void getAllReturnsEmptyWhenOnlyForeignTemplatesExist() throws Exception {
        foreignTemplate();
        var before = jdbcTemplate.queryForList("SELECT * FROM template_blocks ORDER BY id");
        performAsUser(get(BASE + "templateBlock/getAll"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        assertThat(jdbcTemplate.queryForList("SELECT * FROM template_blocks ORDER BY id")).isEqualTo(before);
    }

    /** 他ユーザー所有のテンプレートの更新・削除を拒否する. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void mutateForeignTemplateReturns404(String operation) throws Exception {
        template();
        int foreign = foreignTemplate();
        assertNotFoundWithoutChanges(operation, mutationBody(operation, foreign));
    }

    /** 他ユーザー所有IDと不存在IDのエラー応答から所有情報を判別できない. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void foreignAndMissingTemplatesReturnSameResponse(String operation) throws Exception {
        template();
        int foreign = foreignTemplate();
        var foreignResponse = assertNotFoundWithoutChanges(operation, mutationBody(operation, foreign));
        var missingResponse = assertNotFoundWithoutChanges(operation, mutationBody(operation, -1));
        assertThat(foreignResponse.getStatus()).isEqualTo(missingResponse.getStatus());
        assertThat(foreignResponse.getContentAsByteArray()).isEqualTo(missingResponse.getContentAsByteArray());
        assertThat(foreignResponse.getContentType()).isEqualTo(missingResponse.getContentType());
    }

    /** 本文のuserIdを所有者に偽装しても認証ユーザーが異なれば更新・削除できない. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void spoofedUserIdCannotMutateForeignTemplate(String operation) throws Exception {
        template();
        int foreign = foreignTemplate();
        int foreignUser = jdbcTemplate.queryForObject(
                "SELECT user_id FROM template_blocks WHERE id=?", Integer.class, foreign);
        var body = new java.util.LinkedHashMap<String, Object>(mutationBody(operation, foreign));
        body.put("userId", foreignUser);
        assertNotFoundWithoutChanges(operation, body);
    }

    /** APIを経由せず、別ユーザーとそのユーザー所有のテンプレートを登録する. */
    private int foreignTemplate() {
        String loginId = "template-block-other-user";
        jdbcTemplate.update("INSERT INTO users (login_id,password,role) VALUES (?,?,?)",
                loginId, "unused-test-password", "GENERAL");
        int userId = jdbcTemplate.queryForObject("SELECT id FROM users WHERE login_id=?", Integer.class, loginId);
        jdbcTemplate.update("INSERT INTO template_blocks (user_id,title,width,color) VALUES (?,?,?,?)",
                userId, "他ユーザーのテンプレート", 45, "#123456");
        return jdbcTemplate.queryForObject("SELECT id FROM template_blocks WHERE user_id=?", Integer.class, userId);
    }

    /** 更新では有効な項目を指定し、入力不備による拒否と区別する. */
    private Map<String, Object> mutationBody(String operation, int id) {
        return operation.equals("update")
                ? Map.of("id", id, "title", "変更後のテンプレート", "width", 60, "color", "#abcdef")
                : Map.of("id", id);
    }

    /** 拒否応答と、自分・他ユーザー双方の全テンプレートが不変であることを確認する. */
    private MockHttpServletResponse assertNotFoundWithoutChanges(String operation, Object body) throws Exception {
        var before = jdbcTemplate.queryForList("SELECT * FROM template_blocks ORDER BY id");
        MockHttpServletRequestBuilder request = operation.equals("update")
                ? put(BASE + "templateBlock/update") : delete(BASE + "templateBlock/delete");
        var response = performJsonAsUser(request, body).andExpect(status().isNotFound())
                .andReturn().getResponse();
        assertThat(jdbcTemplate.queryForList("SELECT * FROM template_blocks ORDER BY id")).isEqualTo(before);
        return response;
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
