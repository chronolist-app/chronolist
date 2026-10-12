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

    @Override
    public Integer insertEvent(int userId, CalendarEvent calendarEvent){

        // 受け取ったCalendarEventを元にScheduleを生成(userIdは引数から取得)
        Schedule schedule = Schedule.builder()
                                    .userId(userId)
                                    .kind(calendarEvent.getKind())
                                    .startAt(calendarEvent.getStartAt())
                                    .endAt(calendarEvent.getEndAt())
                                    .startDate(calendarEvent.getStartDate())
                                    .endDate(calendarEvent.getEndDate())
                                    .title(calendarEvent.getTitle())
                                    .build();
        // 生成したScheduleをscheduleテーブルに登録
        mapper.insertSchedule(schedule);

        // scheduleからscheduleIdを取得
        int scheduleId = schedule.getId();
        // 取得したscheduleIdをcalendarEventにset
        calendarEvent.setScheduleId(scheduleId);
        // CalendarEventをcalendar_eventテーブルに登録
        mapper.insertCalendarEvent(calendarEvent);
        // 自動生成されたcalendar_eventのidを取得
        int calendarEventId = calendarEvent.getId();
        // 取得したcalendar_eventのidを返す
        return calendarEventId;
    }

    @Override
    public boolean updateEvent(int userId, CalendarEvent calendarEvent){
        
        // 受け取ったCalendarEventを元にScheduleを生成
        Schedule schedule = Schedule.builder()
                                    .id(calendarEvent.getScheduleId())
                                    .userId(userId)
                                    .kind(calendarEvent.getKind())
                                    .startAt(calendarEvent.getStartAt())
                                    .endAt(calendarEvent.getEndAt())
                                    .startDate(calendarEvent.getStartDate())
                                    .endDate(calendarEvent.getEndDate())
                                    .title(calendarEvent.getTitle())
                                    .build();

        // 生成したScheduleのidを元にscheduleテーブルの更新
        mapper.updateSchedule(schedule);

        // CalendarEventをcalendar_eventテーブルに登録
        int updatedRows = mapper.updateCalendarEvent(userId, calendarEvent);

        return updatedRows == 1;
    }

}
