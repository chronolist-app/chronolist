package com.magu1436.chronolist.timeblocking.service;

import java.time.LocalTime;
import java.util.List;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;

public interface TimeBlockService {
    
    List<TimeBlock> getTimeBlocksByTimeTableId(int loginUser, int timeTableId);

    List<TimeBlock> getHoldBlocks(int loginUser);

    TimeBlock getTimeBlockById(int id, int loginUser);

    int register(int loginUser, TimeBlock timeBlock);

    boolean update(int loginUser, TimeBlock timeBlock);

    boolean delete(int loginUser, int id);

    boolean updateStartAt(int loginUser, int id, LocalTime startAt);
}
