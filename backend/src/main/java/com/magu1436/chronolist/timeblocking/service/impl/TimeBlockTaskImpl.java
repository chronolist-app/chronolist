package com.magu1436.chronolist.timeblocking.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.magu1436.chronolist.timeblocking.entity.TimeBlockTask;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockTaskNotFound;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockTaskMapper;
import com.magu1436.chronolist.timeblocking.service.TimeBlockTaskService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class TimeBlockTaskImpl implements TimeBlockTaskService {

    private final TimeBlockTaskMapper mapper;
    
    /**
     * DB上の {@code TimeBlockTask}を更新する.
     * 
     * @param task 更新する {@code TimeBlockTask}
     * @throws TimeBlockTaskNotFound 指定するIDのデータが見つからないとき
     * @author magu1436
     */
    @Override
    public void update(int userId, TimeBlockTask task) {
        if (mapper.getTimeBlockTaskById(task.getId(), userId) == null) {
            throw new TimeBlockTaskNotFound("TimeBlockTask not found.");
        }
        mapper.updateTimeBlockTask(userId, task);
    }
}
