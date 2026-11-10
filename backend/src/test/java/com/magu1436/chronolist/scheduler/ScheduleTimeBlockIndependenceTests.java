package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.magu1436.chronolist.support.ApiIntegrationTest;

class ScheduleTimeBlockIndependenceTests extends ApiIntegrationTest {
    private static final String BASE = "/api/scheduler/";
    private static final List<String> TIMEBLOCKING_TABLES =
            List.of("time_tables", "time_blocks", "time_block_tasks");

    @ParameterizedTest
    @CsvSource({"DATED,ALL_DAY", "ALL_DAY,CROSS_DAY", "CROSS_DAY,DATED", "DATED,DATED"})
    void eventLifecycleLeavesTimeblockingRowsUnchanged(String initialKind, String updatedKind) throws Exception {
        LocalDate initialDate = LocalDate.of(2026, 11, 2);
        seedTimeblockingRows(initialDate);
        var before = timeblockingRows();

        var created = performJsonAsUser(post(BASE + "register"), eventBody(initialKind, initialDate))
                .andExpect(status().isCreated()).andReturn();
        int eventId = Integer.parseInt(created.getResponse().getContentAsString());
        assertThat(timeblockingRows()).as("after registration").isEqualTo(before);

        var updated = eventBody(updatedKind, initialDate.plusDays(3));
        updated.put("id", eventId);
        performJsonAsUser(put(BASE + "update"), updated).andExpect(status().isNoContent());
        assertThat(timeblockingRows()).as("after update").isEqualTo(before);

        int scheduleId = jdbcTemplate.queryForObject(
                "SELECT schedule_id FROM calendar_event WHERE id = ?", Integer.class, eventId);
        performAsUser(delete(BASE + "delete/{id}", eventId)).andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForList("SELECT id FROM calendar_event WHERE id = ?", eventId)).isEmpty();
        assertThat(jdbcTemplate.queryForList("SELECT id FROM schedule WHERE id = ?", scheduleId)).isEmpty();
        assertThat(timeblockingRows()).as("after deletion").isEqualTo(before);
    }

    @Test
    void changingToAllDayPreservesPreviouslyLinkedBlockAndTask() throws Exception {
        LocalDate date = LocalDate.of(2026, 11, 2);
        var created = performJsonAsUser(post(BASE + "register"), eventBody("DATED", date))
                .andExpect(status().isCreated()).andReturn();
        int eventId = Integer.parseInt(created.getResponse().getContentAsString());
        int blockId = seedTimeblockingRows(date);
        jdbcTemplate.update("""
                UPDATE time_blocks SET schedule_id = (SELECT schedule_id FROM calendar_event WHERE id = ?)
                WHERE id = ?
                """, eventId, blockId);
        var before = timeblockingRows();

        var updated = eventBody("ALL_DAY", date);
        updated.put("id", eventId);
        performJsonAsUser(put(BASE + "update"), updated).andExpect(status().isNoContent());

        assertThat(timeblockingRows()).isEqualTo(before);
    }

    private int seedTimeblockingRows(LocalDate date) {
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
        return blockId;
    }

    private Map<String, List<Map<String, Object>>> timeblockingRows() {
        Map<String, List<Map<String, Object>>> rows = new HashMap<>();
        for (String table : TIMEBLOCKING_TABLES) {
            rows.put(table, jdbcTemplate.queryForList("SELECT * FROM " + table + " ORDER BY id"));
        }
        return rows;
    }

    private Map<String, Object> eventBody(String kind, LocalDate date) {
        Map<String, Object> body = new HashMap<>();
        body.put("title", "予定");
        body.put("color", "#654321");
        if (kind.equals("ALL_DAY")) {
            body.put("kind", "ALL_DAY");
            body.put("startDate", date.toString());
            body.put("endDate", date.toString());
        } else {
            LocalDate endDate = kind.equals("CROSS_DAY") ? date.plusDays(1) : date;
            body.put("kind", "DATED");
            body.put("startAt", date + "T09:15:00");
            body.put("endAt", endDate + "T10:45:00");
        }
        return body;
    }
}
