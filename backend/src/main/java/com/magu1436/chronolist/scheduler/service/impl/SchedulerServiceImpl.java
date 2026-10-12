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

        // 既存の CalendarEventを取得
        CalendarEvent existingEvent = mapper.getCalendarEventById(calendarEvent.getId(), userId);

        if (existingEvent == null) {
            return false; // 既存のイベントが存在しない場合は更新できない
        }
        
        // 受け取ったCalendarEventを元にScheduleを生成
        Schedule schedule = Schedule.builder()
                                    .id(existingEvent.getScheduleId())
                                    .userId(userId)
                                    .kind(calendarEvent.getKind())
                                    .startAt(calendarEvent.getStartAt())
                                    .endAt(calendarEvent.getEndAt())
                                    .startDate(calendarEvent.getStartDate())
                                    .endDate(calendarEvent.getEndDate())
                                    .title(calendarEvent.getTitle())
                                    .build();

        // 生成したScheduleのidを元にscheduleテーブルの更新
        int updatedRowsSchedule = mapper.updateSchedule(schedule);

        // CalendarEventをcalendar_eventテーブルに登録
        int updatedRowsCalendarEvent = mapper.updateCalendarEvent(userId, calendarEvent);

        return updatedRowsSchedule == 1 && updatedRowsCalendarEvent == 1;
    }

    @Override
    public boolean deleteEvent(int userId, int calendarEventId){

        // 受け取ったcalendarEventのidを元に, DBからCalendarEventを取得
        CalendarEvent calendarEvent = mapper.getCalendarEventById(calendarEventId, userId);

        if (calendarEvent == null){
            return false;
        }

        // 取得したcalendarEventからscheduleIdを取得
        int scheduleId = calendarEvent.getScheduleId();

        // calendarEventIdを元に, 対象となるcalendarEventをDBから削除
        mapper.deleteCalendarEvent(calendarEventId, userId);

        // scheduleIdを元に, 対象となるscheduleをDBから削除
        int deletedRows = mapper.deleteSchedule(scheduleId, userId);

        return deletedRows == 1;
    }

}
