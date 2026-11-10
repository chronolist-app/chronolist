package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Connection;
import java.sql.SQLIntegrityConstraintViolationException;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.ConnectionCallback;

import com.fasterxml.jackson.databind.JsonNode;
import com.magu1436.chronolist.support.ApiIntegrationTest;

class ScheduleTimeBlockIndependenceTests extends ApiIntegrationTest {
    private static final String BASE = "/api/scheduler/";
    private static final List<String> TIMEBLOCKING_TABLES =
            List.of("time_tables", "time_blocks", "time_block_tasks");

    @Test
    void schemaKeepsScheduleForeignKeyOnlyOnCalendarEvent() {
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            var metadata = connection.getMetaData();
            try (var columns = metadata.getColumns(connection.getCatalog(), "PUBLIC", "TIME_BLOCKS", "%")) {
                assertThat(columns.next()).isTrue();
                do {
                    assertThat(columns.getString("COLUMN_NAME")).isNotEqualTo("SCHEDULE_ID");
                } while (columns.next());
            }
            assertThat(scheduleForeignKeyColumns(connection, "TIME_BLOCKS")).isEmpty();
            assertThat(scheduleForeignKeyColumns(connection, "CALENDAR_EVENT")).containsExactly("SCHEDULE_ID");
            return null;
        });
    }

    @ParameterizedTest
    @CsvSource({"DATED,ALL_DAY", "ALL_DAY,CROSS_DAY", "CROSS_DAY,DATED", "DATED,DATED"})
    void eventLifecycleLeavesTimeblockingRowsUnchanged(String initialKind, String updatedKind) throws Exception {
        LocalDate initialDate = LocalDate.of(2026, 11, 2);
        seedTimeblockingRows(initialDate);
        var before = timeblockingRows();
        var tableBefore = timeTable(initialDate);

        var created = performJsonAsUser(post(BASE + "register"), eventBody(initialKind, initialDate))
                .andExpect(status().isCreated()).andReturn();
        int eventId = Integer.parseInt(created.getResponse().getContentAsString());
        assertThat(timeblockingRows()).as("after registration").isEqualTo(before);
        assertThat(timeTable(initialDate)).as("after registration").isEqualTo(tableBefore);

        var updated = eventBody(updatedKind, initialDate.plusDays(3));
        updated.put("id", eventId);
        performJsonAsUser(put(BASE + "update"), updated).andExpect(status().isNoContent());
        assertThat(timeblockingRows()).as("after update").isEqualTo(before);
        assertThat(timeTable(initialDate)).as("after update").isEqualTo(tableBefore);

        int scheduleId = jdbcTemplate.queryForObject(
                "SELECT schedule_id FROM calendar_event WHERE id = ?", Integer.class, eventId);
        performAsUser(delete(BASE + "delete/{id}", eventId)).andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForList("SELECT id FROM calendar_event WHERE id = ?", eventId)).isEmpty();
        assertThat(jdbcTemplate.queryForList("SELECT id FROM schedule WHERE id = ?", scheduleId)).isEmpty();
        assertThat(timeblockingRows()).as("after deletion").isEqualTo(before);
        assertThat(timeTable(initialDate)).as("after deletion").isEqualTo(tableBefore);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rollsBackScheduleWhenCalendarEventWriteFails(boolean update) throws Exception {
        LocalDate date = LocalDate.of(2026, 11, 2);
        seedTimeblockingRows(date);
        var request = update ? put(BASE + "update") : post(BASE + "register");
        var body = eventBody("DATED", date);
        if (update) {
            var created = performJsonAsUser(post(BASE + "register"), body)
                    .andExpect(status().isCreated()).andReturn();
            body = eventBody("ALL_DAY", date.plusDays(1));
            body.put("id", Integer.parseInt(created.getResponse().getContentAsString()));
        }
        // The schedule write precedes the event write, which violates calendar_event.color NOT NULL.
        body.put("color", null);
        var scheduleBefore = rows("schedule");
        var eventsBefore = rows("calendar_event");
        var timeblockingBefore = timeblockingRows();

        performJsonAsUser(request, body).andExpect(status().isInternalServerError())
                .andExpect(result -> assertConstraintViolation(result.getResolvedException(), "23502"));

        assertThat(rows("schedule")).isEqualTo(scheduleBefore);
        assertThat(rows("calendar_event")).isEqualTo(eventsBefore);
        assertThat(timeblockingRows()).isEqualTo(timeblockingBefore);
    }

    @Test
    void rollsBackCalendarEventDeletionWhenScheduleIsStillReferenced() throws Exception {
        LocalDate date = LocalDate.of(2026, 11, 2);
        seedTimeblockingRows(date);
        var created = performJsonAsUser(post(BASE + "register"), eventBody("DATED", date))
                .andExpect(status().isCreated()).andReturn();
        int eventId = Integer.parseInt(created.getResponse().getContentAsString());
        jdbcTemplate.update("""
                INSERT INTO calendar_event (schedule_id, color)
                SELECT schedule_id, color FROM calendar_event WHERE id = ?
                """, eventId);
        var scheduleBefore = rows("schedule");
        var eventsBefore = rows("calendar_event");
        var timeblockingBefore = timeblockingRows();

        // The second event still references the schedule when its deletion is attempted.
        performAsUser(delete(BASE + "delete/{id}", eventId)).andExpect(status().isInternalServerError())
                .andExpect(result -> assertConstraintViolation(result.getResolvedException(), "23503"));

        assertThat(rows("schedule")).isEqualTo(scheduleBefore);
        assertThat(rows("calendar_event")).isEqualTo(eventsBefore);
        assertThat(timeblockingRows()).isEqualTo(timeblockingBefore);
    }

    @Test
    void changingToAllDayPreservesBlockAndTaskOnTheSameDay() throws Exception {
        LocalDate date = LocalDate.of(2026, 11, 2);
        var created = performJsonAsUser(post(BASE + "register"), eventBody("DATED", date))
                .andExpect(status().isCreated()).andReturn();
        int eventId = Integer.parseInt(created.getResponse().getContentAsString());
        seedTimeblockingRows(date);
        var before = timeblockingRows();

        var updated = eventBody("ALL_DAY", date);
        updated.put("id", eventId);
        performJsonAsUser(put(BASE + "update"), updated).andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject("""
                SELECT s.kind FROM schedule s JOIN calendar_event e ON e.schedule_id = s.id
                WHERE e.id = ? AND s.start_date = ? AND s.end_date = ?
                """, String.class, eventId, date, date.plusDays(1))).isEqualTo("ALL_DAY");
        assertThat(timeblockingRows()).isEqualTo(before);
    }

    private void assertConstraintViolation(Exception failure, String sqlState) {
        assertThat(failure).isInstanceOf(DataIntegrityViolationException.class)
                .rootCause().isInstanceOfSatisfying(SQLIntegrityConstraintViolationException.class,
                        cause -> assertThat(cause.getSQLState()).isEqualTo(sqlState));
    }

    private JsonNode timeTable(LocalDate date) throws Exception {
        var response = performAsUser(get("/api/timeblocking/timeTable/getByDate/{date}", date))
                .andExpect(status().isOk()).andReturn().getResponse();
        return objectMapper.readTree(response.getContentAsByteArray());
    }

    private List<String> scheduleForeignKeyColumns(Connection connection, String table) throws SQLException {
        var columns = new ArrayList<String>();
        try (var keys = connection.getMetaData().getImportedKeys(connection.getCatalog(), "PUBLIC", table)) {
            while (keys.next()) {
                if ("SCHEDULE".equals(keys.getString("PKTABLE_NAME"))) {
                    assertThat(keys.getString("PKCOLUMN_NAME")).isEqualTo("ID");
                    columns.add(keys.getString("FKCOLUMN_NAME"));
                }
            }
        }
        return columns;
    }

    private void seedTimeblockingRows(LocalDate date) {
        int userId = loginUser.getId();
        jdbcTemplate.update("INSERT INTO time_tables (user_id, date) VALUES (?, ?)", userId, date);
        int tableId = jdbcTemplate.queryForObject(
                "SELECT id FROM time_tables WHERE user_id = ? AND date = ?", Integer.class, userId, date);
        jdbcTemplate.update("""
                INSERT INTO time_blocks (user_id, table_id, title, status, width, start_at, color)
                VALUES (?, ?, '既存ブロック', 'PLACED', 90, '09:15:00', '#123456')
                """, userId, tableId);
        int blockId = jdbcTemplate.queryForObject(
                "SELECT id FROM time_blocks WHERE table_id = ?", Integer.class, tableId);
        jdbcTemplate.update("INSERT INTO time_block_tasks (time_block_id, title) VALUES (?, '既存タスク')", blockId);
    }

    private Map<String, List<Map<String, Object>>> timeblockingRows() {
        Map<String, List<Map<String, Object>>> rows = new HashMap<>();
        for (String table : TIMEBLOCKING_TABLES) {
            rows.put(table, rows(table));
        }
        return rows;
    }

    private List<Map<String, Object>> rows(String table) {
        return jdbcTemplate.queryForList("SELECT * FROM " + table + " ORDER BY id");
    }

    private Map<String, Object> eventBody(String kind, LocalDate date) {
        Map<String, Object> body = new HashMap<>();
        body.put("title", "予定");
        body.put("color", "#654321");
        if (kind.equals("ALL_DAY")) {
            body.put("kind", "ALL_DAY");
            body.put("startDate", date.toString());
            body.put("endDate", date.plusDays(1).toString());
        } else {
            LocalDate endDate = kind.equals("CROSS_DAY") ? date.plusDays(1) : date;
            body.put("kind", "DATED");
            body.put("startAt", date + "T09:15:00");
            body.put("endAt", endDate + "T10:45:00");
        }
        return body;
    }
}
