package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.magu1436.chronolist.scheduler.entity.Schedule;
import com.magu1436.chronolist.scheduler.mapper.SchedulerMapper;
import com.magu1436.chronolist.support.ApiIntegrationTest;

class SchedulerMapperTests extends ApiIntegrationTest {

    @Autowired
    private SchedulerMapper mapper;

    @Test
    void getSchedulesByDateReturnsAllDayAndDatedSchedulesContainingTargetDate() {
        LocalDate targetDate = LocalDate.of(2026, 10, 12);
        int allDayOnTargetDate = insertSchedule(loginUser.getId(), "ALL_DAY", "2026-10-12", "2026-10-13");
        int allDaySpanningTargetDate = insertSchedule(loginUser.getId(), "ALL_DAY", "2026-10-11", "2026-10-13");
        int datedOnTargetDate = insertSchedule(loginUser.getId(), "DATED", "2026-10-12 09:00:00", "2026-10-12 18:00:00");
        int datedSpanningTargetDate = insertSchedule(loginUser.getId(), "DATED", "2026-10-11 23:00:00", "2026-10-12 01:00:00");

        List<Schedule> schedules = mapper.getSchedulesByDate(loginUser.getId(), targetDate);

        assertThat(schedules)
                .extracting(Schedule::getId)
                .containsExactlyInAnyOrder(
                        allDayOnTargetDate,
                        allDaySpanningTargetDate,
                        datedOnTargetDate,
                        datedSpanningTargetDate);
    }

    @Test
    void getSchedulesByDateExcludesSchedulesOutsideTargetDateAndOwnedByOtherUsers() {
        LocalDate targetDate = LocalDate.of(2026, 10, 12);
        insertSchedule(loginUser.getId(), "ALL_DAY", "2026-10-10", "2026-10-12");
        insertSchedule(loginUser.getId(), "ALL_DAY", "2026-10-13", "2026-10-14");
        insertSchedule(loginUser.getId(), "DATED", "2026-10-11 23:00:00", "2026-10-12 00:00:00");
        insertSchedule(loginUser.getId(), "DATED", "2026-10-13 00:00:00", "2026-10-13 01:00:00");
        int otherUserId = insertOtherUser();
        insertSchedule(otherUserId, "ALL_DAY", "2026-10-12", "2026-10-13");
        insertSchedule(otherUserId, "DATED", "2026-10-12 09:00:00", "2026-10-12 18:00:00");

        List<Schedule> schedules = mapper.getSchedulesByDate(loginUser.getId(), targetDate);

        assertThat(schedules).isEmpty();
    }

    @Test
    void getSchedulesFromToExcludesZeroDurationDatedSchedule() {
        insertSchedule(loginUser.getId(), "DATED", "2026-10-13 09:00:00", "2026-10-13 09:00:00");

        assertThat(mapper.getSchedulesFromTo(loginUser.getId(), LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 14)))
                .isEmpty();
    }

    private int insertSchedule(int userId, String kind, String start, String end) {
        boolean dated = kind.equals("DATED");
        jdbcTemplate.update("""
                INSERT INTO schedule (user_id, kind, start_at, end_at, start_date, end_date, title)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                userId,
                kind,
                dated ? start : null,
                dated ? end : null,
                dated ? null : start,
                dated ? null : end,
                "test schedule");
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM schedule", Integer.class);
    }

    private int insertOtherUser() {
        jdbcTemplate.update("""
                INSERT INTO users (login_id, password, role)
                VALUES ('scheduler-mapper-other-user', 'unused', 'GENERAL')
                """);
        return jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE login_id = 'scheduler-mapper-other-user'",
                Integer.class);
    }
}
