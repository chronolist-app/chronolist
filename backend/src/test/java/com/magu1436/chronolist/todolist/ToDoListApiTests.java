package com.magu1436.chronolist.todolist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.sql.Date;
import java.sql.Time;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.magu1436.chronolist.support.ApiIntegrationTest;

/** ToDoのHTTP契約と永続化を実際のDBを使って確認する. */
class ToDoListApiTests extends ApiIntegrationTest {
    private static final String BASE = "/api/todolist/";

    /** 未登録の場合は空配列を返す. */
    @Test
    void getAllReturnsEmptyArray() throws Exception {
        performAsUser(get(BASE + "getAll")).andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    /** 各期限形式と完了状態をJSONへ変換して取得できる. */
    @Test
    void getAllReturnsTaskFields() throws Exception {
        int first = seedTask();
        int second = seedTask();
        int third = seedTask();
        jdbcTemplate.update("UPDATE todo_tasks SET due_kind='NONE', due_date=NULL, due_time=NULL, memo=NULL WHERE id=?", first);
        jdbcTemplate.update("UPDATE todo_tasks SET due_kind='DATED', due_time=NULL, priority='LOW', is_completed=TRUE WHERE id=?", second);
        var result = performAsUser(get(BASE + "getAll")).andExpect(status().isOk()).andReturn();
        var items = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(items.size()).isEqualTo(3);
        Map<Integer, com.fasterxml.jackson.databind.JsonNode> byId = new LinkedHashMap<>();
        items.forEach(item -> byId.put(item.get("id").asInt(), item));
        assertThat(byId.keySet()).containsExactlyInAnyOrder(first, second, third);
        assertThat(byId.get(first).get("dueKind").asText()).isEqualTo("NONE");
        assertThat(byId.get(first).get("dueDate").isNull()).isTrue();
        assertThat(byId.get(first).get("dueTime").isNull()).isTrue();
        assertThat(byId.get(first).get("memo").isNull()).isTrue();
        assertThat(byId.get(second).get("dueKind").asText()).isEqualTo("DATED");
        assertThat(byId.get(second).get("dueDate").asText()).isEqualTo("2026-10-20");
        assertThat(byId.get(second).get("dueTime").isNull()).isTrue();
        assertThat(byId.get(second).get("priority").asText()).isEqualTo("LOW");
        assertThat(byId.get(second).get("isCompleted").asBoolean()).isTrue();
        var dated = byId.get(third);
        assertThat(dated.get("title").asText()).isEqualTo("元のタスク");
        assertThat(dated.get("dueKind").asText()).isEqualTo("DATETIME");
        assertThat(dated.get("dueDate").asText()).isEqualTo("2026-10-20");
        assertThat(dated.get("dueTime").asText()).isEqualTo("09:30:00");
        assertThat(dated.get("priority").asText()).isEqualTo("HIGH");
        assertThat(dated.get("memo").asText()).isEqualTo("元のメモ");
        assertThat(dated.get("isCompleted").asBoolean()).isFalse();
    }

    /** 登録の各期限形式・優先度と初期完了状態を確認する. */
    @ParameterizedTest
    @CsvSource({"NONE,LOW", "DATED,MIDDLE", "DATETIME,HIGH"})
    void registerPersistsFieldsAndReturnsGeneratedId(String kind, String priority) throws Exception {
        var body = taskBody(kind, priority);
        var result = performJsonAsUser(post(BASE + "register"), body)
                .andExpect(status().isOk()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertThat(id).isPositive();
        assertThat(rows()).hasSize(1);
        assertTask(id, body, false);
    }

    /** 全項目の更新と、不要になった期限情報のクリアを確認する. */
    @ParameterizedTest
    @ValueSource(strings = {"NONE", "DATED", "DATETIME"})
    void updateReplacesFieldsAndPreservesOtherTasks(String kind) throws Exception {
        int id = seedTask();
        int untouched = seedTask();
        var before = row(untouched);
        var body = taskBody(kind, "LOW");
        body.put("id", id);
        body.put("isCompleted", true);
        // 仕様書は204だが現実装は201。CHRON-135ではAPIを変更しない。
        performJsonAsUser(put(BASE + "update"), body).andExpect(status().isCreated())
                .andExpect(content().string(""));
        assertTask(id, body, true);
        assertThat(row(untouched)).isEqualTo(before);
        assertThat(rows()).hasSize(2);
    }

    /** 完了・未完了の両方向で、完了状態以外を維持する. */
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void updateStatusOnlyChangesCompletion(boolean completed) throws Exception {
        int id = seedTask();
        jdbcTemplate.update("UPDATE todo_tasks SET is_completed=? WHERE id=?", !completed, id);
        int untouched = seedTask();
        var other = row(untouched);
        var expected = new LinkedHashMap<>(row(id));
        expected.put("IS_COMPLETED", completed);
        performJsonAsUser(put(BASE + "update/status"), Map.of("id", id, "isCompleted", completed))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(row(id)).isEqualTo(expected);
        assertThat(row(untouched)).isEqualTo(other);
    }

    /** 更新対象が存在しない場合は404でデータを変更しない. */
    @ParameterizedTest
    @ValueSource(strings = {"update", "update/status"})
    void updateMissingTaskReturns404(String endpoint) throws Exception {
        seedTask();
        var before = rows();
        var body = taskBody("NONE", "LOW");
        body.put("id", -1);
        body.put("isCompleted", true);
        performJsonAsUser(put(BASE + endpoint), body).andExpect(status().isNotFound())
                .andExpect(content().string(""));
        assertThat(rows()).isEqualTo(before);
    }

    /** 単体・複数削除とも、指定したタスクだけを削除する. */
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void deleteRemovesOnlySelectedTasks(boolean multiple) throws Exception {
        int first = seedTask();
        int second = seedTask();
        int untouched = seedTask();
        var before = row(untouched);
        var secondBefore = row(second);
        var body = multiple ? Map.of("ids", List.of(first, second)) : Map.of("id", first);
        performJsonAsUser(delete(BASE + "delete"), body).andExpect(status().isNoContent())
                .andExpect(content().string(""));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM todo_tasks WHERE id=?", Integer.class, first)).isZero();
        assertThat(row(untouched)).isEqualTo(before);
        if (multiple) {
            assertThat(rows()).containsExactly(before);
        } else {
            assertThat(rows()).containsExactly(secondBefore, before);
        }
    }

    /** 存在しないIDの単体・複数削除は404を返す. */
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void deleteMissingTaskReturns404(boolean multiple) throws Exception {
        seedTask();
        var before = rows();
        var body = multiple ? Map.of("ids", List.of(-1)) : Map.of("id", -1);
        performJsonAsUser(delete(BASE + "delete"), body).andExpect(status().isNotFound());
        assertThat(rows()).isEqualTo(before);
    }

    /** 削除APIで既に処理されている不正形式は400を返す. */
    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"other\":1}", "{\"ids\":[]}", "{\"ids\":1}"})
    void deleteInvalidSelectionReturns400(String json) throws Exception {
        seedTask();
        var before = rows();
        performJsonAsUser(delete(BASE + "delete"), objectMapper.readTree(json))
                .andExpect(status().isBadRequest()).andExpect(content().string(""));
        assertThat(rows()).isEqualTo(before);
    }

    /** APIに依存せず、更新・取得・削除の前提データを作る. */
    private int seedTask() {
        jdbcTemplate.update("""
                INSERT INTO todo_tasks (user_id,title,priority,due_kind,due_date,due_time,is_completed,memo)
                VALUES (?, '元のタスク', 'HIGH', 'DATETIME', '2026-10-20', '09:30:00', FALSE, '元のメモ')
                """, loginUser.getId());
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM todo_tasks", Integer.class);
    }

    /** nullを含むリクエストを作る. */
    private Map<String, Object> taskBody(String kind, String priority) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "変更後のタスク");
        body.put("priority", priority);
        body.put("dueKind", kind);
        body.put("dueDate", kind.equals("NONE") ? null : "2026-11-01");
        body.put("dueTime", kind.equals("DATETIME") ? "15:45:00" : null);
        body.put("memo", "変更後のメモ");
        return body;
    }

    /** APIで送信した業務項目と所有者を独立したSQLで検証する. */
    private void assertTask(int id, Map<String, Object> body, boolean completed) {
        var actual = row(id);
        assertThat(actual.get("USER_ID")).isEqualTo(loginUser.getId());
        assertThat(actual.get("TITLE")).isEqualTo(body.get("title"));
        assertThat(actual.get("PRIORITY")).isEqualTo(body.get("priority"));
        assertThat(actual.get("DUE_KIND")).isEqualTo(body.get("dueKind"));
        assertThat(actual.get("DUE_DATE")).isEqualTo(body.get("dueDate") == null ? null : Date.valueOf((String) body.get("dueDate")));
        assertThat(actual.get("DUE_TIME")).isEqualTo(body.get("dueTime") == null ? null : Time.valueOf((String) body.get("dueTime")));
        assertThat(actual.get("MEMO")).isEqualTo(body.get("memo"));
        assertThat(actual.get("IS_COMPLETED")).isEqualTo(completed);
    }

    /** 指定行を取得する. */
    private Map<String, Object> row(int id) {
        return jdbcTemplate.queryForMap("SELECT * FROM todo_tasks WHERE id=?", id);
    }

    /** データが変更されていないことを検証するため全行を取得する. */
    private List<Map<String, Object>> rows() {
        return jdbcTemplate.queryForList("SELECT * FROM todo_tasks ORDER BY id");
    }
}
