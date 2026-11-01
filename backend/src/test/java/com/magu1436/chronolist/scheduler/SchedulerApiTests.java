package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.magu1436.chronolist.support.ApiIntegrationTest;

/** SchedulerのHTTP契約、期間検索、関連する2テーブルの永続化を検証する. */
class SchedulerApiTests extends ApiIntegrationTest {
    private static final String BASE = "/api/scheduler/";

    /** 対象のない期間は空配列を返す. */
    @Test
    void getEventsReturnsEmptyArray() throws Exception {
        performAsUser(get(BASE + "getEvents/2026-10-12/2026-10-14"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    /** 両端を含む期間重複を判定し、期間外の予定を除外する. */
    @ParameterizedTest
    @ValueSource(strings = {"DATED", "ALL_DAY"})
    void getEventsIncludesOverlapsAndBoundaries(String kind) throws Exception {
        int endsAtStart = seedEvent(kind, "2026-10-11", "2026-10-12");
        int startsAtEnd = seedEvent(kind, "2026-10-14", "2026-10-15");
        int spansRange = seedEvent(kind, "2026-10-10", "2026-10-16");
        int inside = seedEvent(kind, "2026-10-13", "2026-10-13");
        seedEvent(kind, "2026-10-10", "2026-10-11");
        seedEvent(kind, "2026-10-15", "2026-10-16");

        var result = performAsUser(get(BASE + "getEvents/2026-10-12/2026-10-14"))
                .andExpect(status().isOk()).andReturn();
        var events = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(events.size()).isEqualTo(4);
        Map<Integer, com.fasterxml.jackson.databind.JsonNode> byId = new LinkedHashMap<>();
        events.forEach(event -> byId.put(event.get("id").asInt(), event));
        assertThat(byId.keySet()).containsExactlyInAnyOrder(endsAtStart, startsAtEnd, spansRange, inside);
        var event = byId.get(inside);
        var expected = eventBody(kind, "2026-10-13", "2026-10-13");
        for (String field : expected.keySet()) {
            assertThat(event.get(field)).as(field).isEqualTo(objectMapper.valueToTree(expected.get(field)));
        }
        assertThat(event.has("scheduleId")).isFalse();
    }

    /** 同日指定でも、その日に重なる予定を取得する. */
    @Test
    void getEventsSupportsSingleDayAndMixedKinds() throws Exception {
        int timed = seedEvent("DATED", "2026-10-12", "2026-10-12");
        int allDay = seedEvent("ALL_DAY", "2026-10-11", "2026-10-13");
        seedEvent("DATED", "2026-10-13", "2026-10-13");
        var result = performAsUser(get(BASE + "getEvents/2026-10-12/2026-10-12"))
                .andExpect(status().isOk()).andReturn();
        var events = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        java.util.List<Integer> ids = new java.util.ArrayList<>();
        events.forEach(event -> ids.add(event.get("id").asInt()));
        assertThat(ids).containsExactlyInAnyOrder(timed, allDay);
    }

    /** 両種類の予定を2テーブルへ登録し、イベントIDを返す. */
    @ParameterizedTest
    @ValueSource(strings = {"DATED", "ALL_DAY"})
    void registerCreatesLinkedRows(String kind) throws Exception {
        // scheduleとcalendar_eventのIDが偶然一致することに依存しない。
        insertSchedule(eventBody("ALL_DAY", "2026-01-01", "2026-01-01"));
        var body = eventBody(kind, "2026-10-12", "2026-10-14");
        body.put("memo", null);
        var result = performJsonAsUser(post(BASE + "register"), body)
                .andExpect(status().isCreated()).andReturn();
        int id = objectMapper.readValue(result.getResponse().getContentAsByteArray(), Integer.class);
        assertThat(id).isPositive();
        assertThat(events()).hasSize(1);
        assertThat(schedules()).hasSize(2);
        assertEvent(id, body);
        assertThat(eventRow(id).get("SCHEDULE_ID")).isNotEqualTo(id);
    }

    /** 種類を変更すると日付・日時の不要な列をクリアし、両テーブルを更新する. */
    @ParameterizedTest
    @ValueSource(strings = {"DATED", "ALL_DAY"})
    void updateChangesBothRowsAndPreservesUnrelatedEvents(String kind) throws Exception {
        insertSchedule(eventBody("ALL_DAY", "2026-01-01", "2026-01-01"));
        int id = seedEvent(kind.equals("DATED") ? "ALL_DAY" : "DATED", "2026-10-12", "2026-10-14");
        int other = seedEvent("DATED", "2026-10-20", "2026-10-20");
        var eventBefore = eventRow(other);
        var scheduleBefore = scheduleRow(scheduleId(other));
        int scheduleId = scheduleId(id);
        var body = eventBody(kind, "2026-11-01", "2026-11-03");
        body.put("id", id);
        body.put("title", "更新後の予定");
        body.put("color", "BLUE");
        body.put("memo", null);
        // scheduleIdを送信せず、DB上の関連付けを使う。
        performJsonAsUser(put(BASE + "update"), body)
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertEvent(id, body);
        assertThat(scheduleId(id)).isEqualTo(scheduleId);
        assertThat(eventRow(other)).isEqualTo(eventBefore);
        assertThat(scheduleRow(scheduleId(other))).isEqualTo(scheduleBefore);
        assertThat(events()).hasSize(2);
        assertThat(schedules()).hasSize(3);
    }

    /** 不明なイベントの更新は404を返し、DBを変更しない. */
    @Test
    void updateMissingEventReturns404() throws Exception {
        seedEvent("DATED", "2026-10-12", "2026-10-12");
        var eventsBefore = events();
        var schedulesBefore = schedules();
        var body = eventBody("ALL_DAY", "2026-11-01", "2026-11-03");
        body.put("id", -1);
        performJsonAsUser(put(BASE + "update"), body)
                .andExpect(status().isNotFound()).andExpect(content().string(""));
        assertThat(events()).isEqualTo(eventsBefore);
        assertThat(schedules()).isEqualTo(schedulesBefore);
    }

    /** イベントとその予定だけを削除する. */
    @ParameterizedTest
    @ValueSource(strings = {"DATED", "ALL_DAY"})
    void deleteRemovesBothLinkedRows(String kind) throws Exception {
        int standalone = insertSchedule(eventBody("ALL_DAY", "2026-01-01", "2026-01-01"));
        int id = seedEvent(kind, "2026-10-12", "2026-10-14");
        int other = seedEvent("DATED", "2026-10-20", "2026-10-20");
        int removedSchedule = scheduleId(id);
        var otherEvent = eventRow(other);
        var otherSchedule = scheduleRow(scheduleId(other));
        var standaloneBefore = scheduleRow(standalone);
        performAsUser(delete(BASE + "delete/{id}", id))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(events()).containsExactly(otherEvent);
        assertThat(schedules()).containsExactly(standaloneBefore, otherSchedule);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM schedule WHERE id=?", Integer.class, removedSchedule)).isZero();
    }

    /** 不明なイベントの削除は404を返し、DBを変更しない. */
    @Test
    void deleteMissingEventReturns404() throws Exception {
        seedEvent("DATED", "2026-10-12", "2026-10-12");
        var eventsBefore = events();
        var schedulesBefore = schedules();
        performAsUser(delete(BASE + "delete/{id}", -1))
                .andExpect(status().isNotFound()).andExpect(content().string(""));
        assertThat(events()).isEqualTo(eventsBefore);
        assertThat(schedules()).isEqualTo(schedulesBefore);
    }

    /** APIに依存せずカレンダーイベントを作る. */
    private int seedEvent(String kind, String start, String end) {
        var body = eventBody(kind, start, end);
        int scheduleId = insertSchedule(body);
        jdbcTemplate.update("INSERT INTO calendar_event (schedule_id,color,memo) VALUES (?,?,?)",
                scheduleId, body.get("color"), body.get("memo"));
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM calendar_event", Integer.class);
    }

    /** 共通テストユーザーの予定を作る. */
    private int insertSchedule(Map<String, Object> body) {
        jdbcTemplate.update("""
                INSERT INTO schedule (user_id,kind,start_at,end_at,start_date,end_date,title)
                VALUES (?,?,?,?,?,?,?)
                """, loginUser.getId(), body.get("kind"), body.get("startAt"), body.get("endAt"),
                body.get("startDate"), body.get("endDate"), body.get("title"));
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM schedule", Integer.class);
    }

    /** 仕様どおり、予定の種類に応じて不要な日時項目をnullにする. */
    private Map<String, Object> eventBody(String kind, String start, String end) {
        boolean timed = kind.equals("DATED");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kind", kind);
        body.put("startAt", timed ? start + "T09:30:00" : null);
        body.put("endAt", timed ? end + "T17:45:00" : null);
        body.put("startDate", timed ? null : start);
        body.put("endDate", timed ? null : end);
        body.put("title", "テストの予定");
        body.put("color", "RED");
        body.put("memo", "予定のメモ");
        return body;
    }

    /** 独立したSQLで両テーブルの項目と関連付けを検証する. */
    private void assertEvent(int id, Map<String, Object> body) {
        var event = eventRow(id);
        var schedule = scheduleRow(scheduleId(id));
        assertThat(event.get("COLOR")).isEqualTo(body.get("color"));
        assertThat(event.get("MEMO")).isEqualTo(body.get("memo"));
        assertThat(schedule.get("USER_ID")).isEqualTo(loginUser.getId());
        assertThat(schedule.get("KIND")).isEqualTo(body.get("kind"));
        assertThat(schedule.get("TITLE")).isEqualTo(body.get("title"));
        for (String field : List.of("startAt", "endAt")) {
            String column = field.equals("startAt") ? "START_AT" : "END_AT";
            Object expected = body.get(field) == null ? null : Timestamp.valueOf(((String) body.get(field)).replace('T', ' '));
            assertThat(schedule.get(column)).as(field).isEqualTo(expected);
        }
        for (String field : List.of("startDate", "endDate")) {
            String column = field.equals("startDate") ? "START_DATE" : "END_DATE";
            Object expected = body.get(field) == null ? null : Date.valueOf((String) body.get(field));
            assertThat(schedule.get(column)).as(field).isEqualTo(expected);
        }
    }

    /** イベントに対応する予定IDを取得する. */
    private int scheduleId(int id) {
        return (Integer) eventRow(id).get("SCHEDULE_ID");
    }

    /** 指定イベントのDB行を取得する. */
    private Map<String, Object> eventRow(int id) {
        return jdbcTemplate.queryForMap("SELECT * FROM calendar_event WHERE id=?", id);
    }

    /** 指定予定のDB行を取得する. */
    private Map<String, Object> scheduleRow(int id) {
        return jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", id);
    }

    /** イベント全行を取得する. */
    private List<Map<String, Object>> events() {
        return jdbcTemplate.queryForList("SELECT * FROM calendar_event ORDER BY id");
    }

    /** 予定全行を取得する. */
    private List<Map<String, Object>> schedules() {
        return jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id");
    }
}
