package com.magu1436.chronolist.scheduler.entity;

/**
 * ScheduleKind型を定義する列挙型クラス
 * scheduleが通常予定(DATED)か終日予定(ALL_DAY)かを分ける
 * @author konoma1103
 */
public enum ScheduleKind {
    DATED,
    ALL_DAY;
}
