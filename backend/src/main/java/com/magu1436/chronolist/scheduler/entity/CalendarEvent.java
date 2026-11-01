package com.magu1436.chronolist.scheduler.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.NoArgsConstructor;


/** 
 * CalendarEventエンティティの情報を保持するクラス
 * @author konoma1103
 */
@Data
@NoArgsConstructor
public class CalendarEvent {
    /** カレンダーイベントID */
    private Integer id;
    /** ユーザーID */
    private int userId;
    /** スケジュールID */
    @JsonIgnore
    private int scheduleId;
    /** スケジュールの種類 */
    private ScheduleKind kind;
    /** 開始時刻 */
    private LocalDateTime startAt;
    /** 終了時刻 */
    private LocalDateTime endAt;
    /** 開始日 */
    private LocalDate startDate;
    /** 終了日 */
    private LocalDate endDate;
    /** タイトル */
    private String title;
    /** 色 */
    private String color;
    /** メモ */
    private String memo;
}
