package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.magu1436.chronolist.scheduler.entity.CalendarEvent;
import com.magu1436.chronolist.scheduler.mapper.SchedulerMapper;
import com.magu1436.chronolist.support.ApiIntegrationTest;

/** CHRON-137: real SQL ownership checks and transaction boundaries through HTTP.
 * The spy delegates to the real Mapper except when explicitly injecting a zero-row failure.
 */
class SchedulerIdorTests extends ApiIntegrationTest {
    private static final String BASE = "/api/scheduler/";

    @MockitoSpyBean
    private SchedulerMapper mapper;

    private int otherUser() {
        jdbcTemplate.update("INSERT INTO users (login_id,password,role) VALUES ('other-user','unused','GENERAL')");
        return jdbcTemplate.queryForObject("SELECT id FROM users WHERE login_id='other-user'", Integer.class);
    }

    private int seed(int owner, String kind) {
        // Offset the sequences so event ID cannot stand in for Schedule ID.
        jdbcTemplate.update("INSERT INTO schedule (user_id,kind,start_date,end_date,title) VALUES (?,'ALL_DAY','2026-01-01','2026-01-01','standalone')", owner);
        jdbcTemplate.update("""
                INSERT INTO schedule (user_id,kind,start_at,end_at,start_date,end_date,title)
                VALUES (?,?,?,?,?,?,?)
                """, owner, kind, kind.equals("DATED") ? "2026-10-12 09:00:00" : null,
                kind.equals("DATED") ? "2026-10-12 10:00:00" : null,
                kind.equals("ALL_DAY") ? "2026-10-12" : null,
                kind.equals("ALL_DAY") ? "2026-10-12" : null, "original");
        int schedule = jdbcTemplate.queryForObject("SELECT MAX(id) FROM schedule", Integer.class);
        jdbcTemplate.update("INSERT INTO calendar_event (schedule_id,color,memo) VALUES (?,'RED','original')", schedule);
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM calendar_event", Integer.class);
    }

    private int scheduleId(int event) {
        return jdbcTemplate.queryForObject("SELECT schedule_id FROM calendar_event WHERE id=?", Integer.class, event);
    }

    private Map<String, Object> body(int event) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", event);
        body.put("kind", "ALL_DAY");
        body.put("startDate", "2026-11-01");
        body.put("endDate", "2026-11-02");
        body.put("title", "changed");
        body.put("color", "BLUE");
        body.put("memo", "changed");
        return body;
    }

    private List<Map<String, Object>> schedules() {
        return jdbcTemplate.queryForList("SELECT * FROM schedule ORDER BY id");
    }

    private List<Map<String, Object>> events() {
        return jdbcTemplate.queryForList("SELECT * FROM calendar_event ORDER BY id");
    }

    @ParameterizedTest
    @ValueSource(strings = {"DATED", "ALL_DAY"})
    void listingExcludesOtherOwner(String kind) throws Exception {
        int own = seed(loginUser.getId(), kind);
        seed(otherUser(), kind);
        var result = performAsUser(get(BASE + "getEvents/2026-10-12/2026-10-12"))
                .andExpect(status().isOk()).andReturn();
        var rows = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(rows.size()).isEqualTo(1);
        assertThat(rows.get(0).get("id").asInt()).isEqualTo(own);
    }

    @ParameterizedTest
    @ValueSource(strings = {"update", "delete"})
    void foreignAndMissingResourcesHaveSame404AndPreserveDatabase(String operation) throws Exception {
        int own = seed(loginUser.getId(), "ALL_DAY");
        int foreign = seed(otherUser(), "DATED");
        var schedulesBefore = schedules();
        var eventsBefore = events();
        for (int id : new int[] {foreign, -1}) {
            var payload = body(id);
            payload.put("scheduleId", scheduleId(own));
            payload.put("userId", loginUser.getId());
            var response = operation.equals("update")
                    ? performJsonAsUser(put(BASE + "update"), payload)
                    : performAsUser(delete(BASE + "delete/{id}", id));
            response.andExpect(status().isNotFound()).andExpect(content().string(""));
            assertThat(schedules()).isEqualTo(schedulesBefore);
            assertThat(events()).isEqualTo(eventsBefore);
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void updateIgnoresForgedScheduleAndUserId(boolean foreignTarget) throws Exception {
        int own = seed(loginUser.getId(), "DATED");
        int otherOwner = otherUser();
        int decoy = seed(foreignTarget ? otherOwner : loginUser.getId(), "ALL_DAY");
        int linked = scheduleId(own);
        var decoySchedule = jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", scheduleId(decoy));
        var decoyEvent = jdbcTemplate.queryForMap("SELECT * FROM calendar_event WHERE id=?", decoy);
        var payload = body(own);
        payload.put("scheduleId", scheduleId(decoy));
        payload.put("userId", otherOwner);
        performJsonAsUser(put(BASE + "update"), payload).andExpect(status().isNoContent());
        assertThat(scheduleId(own)).isEqualTo(linked);
        var changed = jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", linked);
        assertThat(changed.get("TITLE")).isEqualTo("changed");
        assertThat(changed.get("USER_ID")).isEqualTo(loginUser.getId());
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM calendar_event WHERE id=?", own).get("MEMO")).isEqualTo("changed");
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM schedule WHERE id=?", scheduleId(decoy))).isEqualTo(decoySchedule);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM calendar_event WHERE id=?", decoy)).isEqualTo(decoyEvent);
    }

    @ParameterizedTest
    @ValueSource(strings = {"getSchedule", "getEvent", "updateSchedule", "updateEvent", "deleteSchedule", "deleteEvent"})
    void mapperScopesOperationToOwner(String operation) {
        int owner = otherUser();
        int event = seed(owner, "ALL_DAY");
        int schedule = scheduleId(event);
        var schedulesBefore = schedules();
        var eventsBefore = events();
        switch (operation) {
            case "getSchedule" -> {
                assertThat(mapper.getScheduleById(schedule, owner)).isNotNull();
                assertThat(mapper.getScheduleById(schedule, loginUser.getId())).isNull();
            }
            case "getEvent" -> {
                assertThat(mapper.getCalendarEventById(event, owner)).isNotNull();
                assertThat(mapper.getCalendarEventById(event, loginUser.getId())).isNull();
            }
            case "updateSchedule" -> {
                var update = mapper.getScheduleById(schedule, owner);
                update.setUserId(loginUser.getId());
                update.setTitle("attack");
                assertThat(mapper.updateSchedule(update)).isZero();
            }
            case "updateEvent" -> {
                var update = mapper.getCalendarEventById(event, owner);
                update.setMemo("attack");
                assertThat(mapper.updateCalendarEvent(loginUser.getId(), update)).isZero();
            }
            case "deleteEvent" -> assertThat(mapper.deleteCalendarEvent(event, loginUser.getId())).isZero();
            case "deleteSchedule" -> assertThat(mapper.deleteSchedule(schedule, loginUser.getId())).isZero();
            default -> throw new AssertionError(operation);
        }
        assertThat(schedules()).isEqualTo(schedulesBefore);
        assertThat(events()).isEqualTo(eventsBefore);
    }

    @Test
    void zeroRowSecondUpdateReturns404AndRollsBackFirstUpdate() throws Exception {
        int event = seed(loginUser.getId(), "ALL_DAY");
        var schedulesBefore = schedules();
        var eventsBefore = events();
        doReturn(0).when(mapper).updateCalendarEvent(eq(loginUser.getId()), any(CalendarEvent.class));
        var result = performJsonAsUser(put(BASE + "update"), body(event)).andReturn();
        verify(mapper).updateSchedule(any());
        verify(mapper).updateCalendarEvent(eq(loginUser.getId()), any(CalendarEvent.class));
        org.assertj.core.api.SoftAssertions softly = new org.assertj.core.api.SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).isEqualTo(404);
        softly.assertThat(schedules()).isEqualTo(schedulesBefore);
        softly.assertThat(events()).isEqualTo(eventsBefore);
        softly.assertAll();
    }

    @Test
    void zeroRowSecondDeleteReturns404AndRollsBackFirstDelete() throws Exception {
        int event = seed(loginUser.getId(), "ALL_DAY");
        int schedule = scheduleId(event);
        var schedulesBefore = schedules();
        var eventsBefore = events();
        doReturn(0).when(mapper).deleteSchedule(schedule, loginUser.getId());
        var result = performAsUser(delete(BASE + "delete/{id}", event)).andReturn();
        verify(mapper).deleteCalendarEvent(event, loginUser.getId());
        verify(mapper).deleteSchedule(schedule, loginUser.getId());
        org.assertj.core.api.SoftAssertions softly = new org.assertj.core.api.SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).isEqualTo(404);
        softly.assertThat(schedules()).isEqualTo(schedulesBefore);
        softly.assertThat(events()).isEqualTo(eventsBefore);
        softly.assertAll();
    }
}
