package com.magu1436.chronolist.timeblocking.entity;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * TemplateBlockエンティティの情報を保持するクラス
 * @author magu1436
 */
@Data
@NoArgsConstructor
public class TemplateBlock {
    private int id;
    private int userId;
    private String title;
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = BlockWidthDeserializer.class)
    private Integer width;
    private String color;
}
