package com.magu1436.chronolist.scheduler.mapper;

import java.util.List;
import java.time.LocalDate;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.magu1436.chronolist.scheduler.entity.Schedule;
import com.magu1436.chronolist.scheduler.entity.CalendarEvent;


/** 
 * schedulerアプリケーションのマッパー関数を定義するインターフェース
 * @author konoma1103
 */
@Mapper
public interface SchedulerMapper {
    /** 指定の区間が期日のスケジュールを全て取得 */
    List<Schedule> getSchedulesFromTo(
        @Param("userId") int userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
    /** 指定のidをもつスケジュールを取得 */
    Schedule getScheduleById(@Param("id") int id, @Param("userId") int userId);
    /** 指定の日にあるスケジュールを全て取得 */
    List<Schedule> getSchedulesByDate(@Param("userId") int userId, @Param("date") LocalDate date);
    /** スケジュールの新規登録 */
    int insertSchedule(Schedule schedule);
    /** スケジュールの更新 */
    int updateSchedule(Schedule schedule);
    /** 受け取ったidのスケジュールを削除 */
    void deleteSchedule(int id);
    /** 指定の区間が期日のカレンダーイベントを全て取得 */
    List<CalendarEvent> getCalendarEventsFromTo(
        @Param("userId") int userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
    /** 指定のidをもつカレンダーイベントを取得 */
    CalendarEvent getCalendarEventById(int id);
    /** カレンダーイベントの新規登録 */
    int insertCalendarEvent(CalendarEvent calendarEvent);
    /** カレンダーイベントの更新 */
    void updateCalendarEvent(CalendarEvent calendarEvent);
    /** 受け取ったidのカレンダーイベントを削除 */
    void deleteCalendarEvent(int id);
}
