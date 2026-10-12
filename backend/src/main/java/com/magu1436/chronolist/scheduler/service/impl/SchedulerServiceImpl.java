package com.magu1436.chronolist.scheduler.service.impl;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;

import com.magu1436.chronolist.scheduler.entity.CalendarEvent;
import com.magu1436.chronolist.scheduler.entity.Schedule;
import com.magu1436.chronolist.scheduler.mapper.SchedulerMapper;
import com.magu1436.chronolist.scheduler.service.SchedulerService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SchedulerServiceImpl implements SchedulerService {

    private final SchedulerMapper mapper;

    @Override
    public List<CalendarEvent> getEvents(
        int userId,
        LocalDate starDate,
        LocalDate enddDate
    ) {
        return mapper.getCalendarEventsFromTo(userId, starDate, enddDate);
    }

}
