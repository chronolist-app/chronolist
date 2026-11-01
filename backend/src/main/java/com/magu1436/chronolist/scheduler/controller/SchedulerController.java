package com.magu1436.chronolist.scheduler.controller;

import java.util.List;
import java.time.LocalDate;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.magu1436.chronolist.login.LoginUser;
import com.magu1436.chronolist.scheduler.entity.CalendarEvent;
import com.magu1436.chronolist.scheduler.exception.EventNotFoundException;
import com.magu1436.chronolist.scheduler.service.SchedulerService;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;


/** 
 * schedulerアプリケーションのcontroller
 * @author konoma1103
 */
@RequestMapping("api/scheduler/")
@Controller
@RequiredArgsConstructor
public class SchedulerController {

    private final SchedulerService service;

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
        List<CalendarEvent> calendarEvents = service.getEvents(loginUser.getId(), startDate, endDate);
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
    public ResponseEntity<Integer> insertEvent(
        @AuthenticationPrincipal LoginUser loginUser,
        @RequestBody CalendarEvent calendarEvent
    ) {
        Integer calendarEventId = service.insertEvent(loginUser.getId(), calendarEvent);
        // 取得したcalendar_eventのidを返す
        return ResponseEntity.status(HttpStatus.CREATED).body(calendarEventId);
    }

    /**
     * 予定更新API. 
     * 受け取った {@code CalendarEvent} の {@code id} を元に, スケジュールおよびカレンダーイベントを更新する
     * @param calendarEvent 更新したい {@code calendarEvent}
     * @param loginUser ログイン中のユーザー
     * @return bodyが空の {@code ResponseEntity}. 
     * 更新成功時は204、対象を所有していない場合や更新件数が不足した場合は404を返す
     * @author konoma1103
     */
    @PutMapping("update")
    public ResponseEntity<Void> updateEvent(@RequestBody CalendarEvent calendarEvent, @AuthenticationPrincipal LoginUser loginUser) {
        try {
            service.updateEvent(loginUser.getId(), calendarEvent);
        } catch (EventNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * 予定削除API. 
     * 受け取ったidに一致するスケジュールおよびカレンダーイベントをDBから削除する
     * @param calendarEventId 削除したいカレンダーイベントの {@code id}
     * @return bodyが空の {@code ResponseEntity} 
     * 削除成功時は204、対象を所有していない場合や削除件数が不足した場合は404を返す
     * @author konoma1103
     */
    @DeleteMapping("delete/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable("id") int calendarEventId, @AuthenticationPrincipal LoginUser loginUser){
        try {
            service.deleteEvent(loginUser.getId(), calendarEventId);
        } catch (EventNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
       
}
