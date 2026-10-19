package com.magu1436.chronolist.timeblocking.service;

import com.magu1436.chronolist.timeblocking.entity.TimeBlockTask;

public interface TimeBlockTaskService {

    int registerTimeBlockTask(int userId, TimeBlockTask timeBlockTask);

    boolean updateTimeBlockTask(int userId, TimeBlockTask timeBlockTask);
    
    boolean deleteTimeBlockTask(int userId, int id);

}
