package com.magu1436.chronolist.scheduler.controller;

import java.util.List;
import java.time.LocalDate;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.magu1436.chronolist.login.LoginUser;
import com.magu1436.chronolist.scheduler.entity.CalendarEvent;
import com.magu1436.chronolist.scheduler.entity.Schedule;
import com.magu1436.chronolist.scheduler.mapper.SchedulerMapper;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;


/** 
 * schedulerアプリケーションのcontroller
 * @author konoma1103
 */
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("api/scheduler/")
@Controller
@RequiredArgsConstructor
public class SchedulerController {

    private final SchedulerMapper mapper;

    /** 
     * 特定期間のカレンダーイベント取得API.
     * DBに登録されているカレンダーイベントのうち, 指定した期間のカレンダーイベントを返す
     * @param loginUser ログイン中のユーザー
     * @param startDate 指定期間の開始日
     * @param endDate 指定期間の終了日
     * @return 指定期間に一致したカレンダーイベントのリスト, 
     * 指定した期間に一致するカレンダーイベントが存在しなかったときは {@code null} 
     * をbodyに持った {@code ResponseEntity} 
     * @author konoma1103
     */ 
    @GetMapping("getEvents/{startDate}/{endDate}")
    public ResponseEntity<List<CalendarEvent>> getEvent(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("startDate") LocalDate startDate,
            @PathVariable("endDate") LocalDate endDate
        ){
        List<CalendarEvent> calendarEvents = mapper.getCalendarEventsFromTo(loginUser.getId(), startDate, endDate);
        return ResponseEntity.ok(calendarEvents);
    }

    /**
     * 予定登録API.
     * 新しいスケジュールおよびカレンダーイベントをDBに登録する
     * @param loginUser ログイン中のユーザー
     * @param calendarEvent DBに登録したい {@code calendarEvent} エンティティ. {@code id} はDB登録時に自動生成されるため持たない
     * @return bodyに「登録した {@code calendarEvent} に自動で付与された {@code id} 」を持った {@code ResponseEntity} 
     * @author konoma1103
     */
    @PostMapping("register")
    public ResponseEntity<Integer> insertEvent(@AuthenticationPrincipal LoginUser loginUser, @RequestBody CalendarEvent calendarEvent) {
        // 受け取ったCalendarEventを元にScheduleを生成(userIdは引数から取得)
        Schedule schedule = Schedule.builder()
                                    .userId(loginUser.getId())
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
        return ResponseEntity.status(HttpStatus.CREATED).body(calendarEventId);
    }

    /**
     * 予定更新API. 
     * 受け取った {@code CalendarEvent} の {@code id} を元に, スケジュールおよびカレンダーイベントを更新する
     * @param calendarEvent 更新したい {@code calendarEvent}
     * @return bodyが空の {@code ResponseEntity}. 
     * 受け取った {@code calendarEvent} の {@code id} がDBに存在するときは201レスポンス, 
     * 存在しないときは404レスポンスを返す
     * @author konoma1103
     */
    @PutMapping("update")
    @Transactional
    public ResponseEntity<Void> updateEvent(@RequestBody CalendarEvent calendarEvent) {
        // 受け取ったcalendarEventがDBに存在するか確認(存在しなかった場合は400レスポンスを返す)
        CalendarEvent existingCalendarEvent = mapper.getCalendarEventById(calendarEvent.getId());
        if(existingCalendarEvent == null){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        // 受け取ったCalendarEventを元にScheduleを生成
        Schedule schedule = Schedule.builder()
                                    .id(existingCalendarEvent.getScheduleId())
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
        mapper.updateCalendarEvent(calendarEvent);

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * 予定削除API. 
     * 受け取ったidに一致するスケジュールおよびカレンダーイベントをDBから削除する
     * @param calendarEventId 削除したいカレンダーイベントの {@code id}
     * @return bodyが空の {@code ResponseEntity} 
     * 受け取った {@code calendarEventId} がDBに存在するときは201レスポンス, 
     * 存在しないときは404レスポンスを返す
     * @author konoma1103
     */
    @DeleteMapping("delete/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable("id") int calendarEventId){
        // 受け取ったcalendarEventがDBに存在するか確認(存在しなかった場合は400レスポンスを返す)
        if(!existsById(calendarEventId)){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        // 受け取ったcalendarEventのidを元に, DBからCalendarEventを取得
        CalendarEvent calendarEvent = mapper.getCalendarEventById(calendarEventId);
        // 取得したcalendarEventからscheduleIdを取得
        int scheduleId = calendarEvent.getScheduleId();

        // calendarEventIdを元に, 対象となるcalendarEventをDBから削除
        mapper.deleteCalendarEvent(calendarEventId);

        // scheduleIdを元に, 対象となるscheduleをDBから削除
        mapper.deleteSchedule(scheduleId);

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }


    /** 指定したidのcalendarEventがDBに存在するか確認するメソッド 
     * @param id DBに存在するかを確認したいcalendarEventの{@code id}
     * @return DB上に存在するとき:{@code True}
     * DB上に存在しないとき:{@code False}
     * @author konoma1103
    */
    private boolean existsById(int id){
        CalendarEvent calendarEvent = mapper.getCalendarEventById(id);
        return calendarEvent != null;
    }
       
}
