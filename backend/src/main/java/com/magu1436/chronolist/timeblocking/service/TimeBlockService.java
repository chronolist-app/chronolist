package com.magu1436.chronolist.timeblocking.service;

import java.util.List;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;

public interface TimeBlockService {
    public List<TimeBlock> getTimeBlocksByTimeTableId(int userId, int timeTableId);
}
