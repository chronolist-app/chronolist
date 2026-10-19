package com.magu1436.chronolist.timeblocking.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.magu1436.chronolist.timeblocking.entity.TimeBlockTask;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockReferenceNotFoundException;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockTaskMapper;
import com.magu1436.chronolist.timeblocking.service.TimeBlockTaskService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class TimeBlockTaskImpl implements TimeBlockTaskService {

    private final TimeBlockTaskMapper mapper;
    
    @Override
    public int registerTimeBlockTask(int userId, TimeBlockTask timeBlockTask){
        int insertRows = mapper.insertTimeBlockTask(userId, timeBlockTask);
        if (insertRows != 1){
            throw new TimeBlockReferenceNotFoundException(
                "参照先のタイムブロックが見つかりません"
            );
        }
        return timeBlockTask.getId();
    }

    @Override 
    public boolean updateTimeBlockTask(int userId, TimeBlockTask timeBlockTask){
        int updateRows = mapper.updateTimeBlockTask(userId, timeBlockTask);
        return updateRows == 1;
    }

    @Override 
    public boolean deleteTimeBlockTask(int userId, int id){
        int deleteRows = mapper.deleteTimeBlockTask(id, userId);
        return deleteRows ==1;
    }

}
