package com.magu1436.chronolist.timeblocking.service;

import com.magu1436.chronolist.scheduler.entity.Schedule;
import java.time.LocalTime;
import java.util.List;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;

public interface TimeBlockService {
    
    List<TimeBlock> getTimeBlocksByTimeTableId(int loginUser, int timeTableId);

    List<TimeBlock> getHoldBlocks(int loginUser);

    TimeBlock getTimeBlockById(int id, int loginUser);

    int register(int loginUser, TimeBlock timeBlock);

    /** 予定の内容を引き継いだ配置済みブロックを登録する。 */
    int registerFromSchedule(int userId, int timeTableId, Schedule schedule, String color);

    boolean update(int loginUser, TimeBlock timeBlock);

    boolean delete(int loginUser, int id);

    boolean updateStartAt(int loginUser, int id, LocalTime startAt);
}
