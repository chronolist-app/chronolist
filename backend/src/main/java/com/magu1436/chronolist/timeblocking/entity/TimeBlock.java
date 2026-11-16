package com.magu1436.chronolist.timeblocking.entity;

import java.time.LocalTime;
import java.util.List;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * TimeBlockエンティティの情報を保持するクラス
 * @author magu1436
 */
@Data
@NoArgsConstructor
public class TimeBlock {
    private int id;
    private int userId;
    private Integer timeTableId;
    private String title;
    private TimeBlockStatus status;
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = BlockWidthDeserializer.class)
    private Integer width;
    private LocalTime startAt;
    private List<TimeBlockTask> tasks;
    private String color;
}
