package com.magu1436.chronolist.timeblocking.entity;

import lombok.Data;
import lombok.NoArgsConstructor;

/** 
 * TimeBlockTaskエンティティの情報を保持するクラス
 * @author konoma1103
 **/
@Data
@NoArgsConstructor
public class TimeBlockTask {
    private int id;
    private int timeBlockId;
    private String title;
}
