package com.magu1436.chronolist.timeblocking.service;

import java.util.List;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;

public interface TimeBlockService {
    
    public List<TimeBlock> getTimeBlocksByTimeTableId(int loginUser, int timeTableId);

    public List<TimeBlock> getHoldBlocks(int loginUser);

    public TimeBlock getTimeBlockById(int id, int loginUser);

    public int register(int loginUser, TimeBlock timeBlock);

    public boolean update(int loginUser, TimeBlock timeBlock);

    public boolean delete(int loginUser, int id);
}
