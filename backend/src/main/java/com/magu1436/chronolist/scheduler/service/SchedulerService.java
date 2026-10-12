package com.magu1436.chronolist.scheduler.service;

import java.time.LocalDate;
import java.util.List;

import com.magu1436.chronolist.scheduler.entity.CalendarEvent;

public interface SchedulerService {

    List<CalendarEvent> getEvents(
        int userId,
        LocalDate startDate,
        LocalDate endDate
    );

    Integer insertEvent(int userId, CalendarEvent calendarEvent);

    void updateEvent(int userId, CalendarEvent calendarEvent);

    void deleteEvent(int userId, int calendarEventId);

}
