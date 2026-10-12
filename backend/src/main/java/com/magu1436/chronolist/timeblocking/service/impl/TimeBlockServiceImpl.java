package com.magu1436.chronolist.timeblocking.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockReferenceNotFoundException;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper;
import com.magu1436.chronolist.timeblocking.service.TimeBlockService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class TimeBlockServiceImpl implements TimeBlockService {
    
    private final TimeBlockMapper mapper;

    @Override 
    @Transactional(readOnly = true)
    public TimeBlock getTimeBlockById(int id, int userId){
        return mapper.getTimeBlockById(id, userId);
    }

    /**
     * 指定した {@code timeTableId} をもつ {@link TimeBlock} を取得する
     * 
     * @param timeTableId 取得対象の {@code timeTable} のID
     * @return 対応する {@link TimeBlock} のリスト
     */
    @Override 
    @Transactional(readOnly = true)
    public List<TimeBlock> getTimeBlocksByTimeTableId(int loginUser, int timeTableId) {
        return mapper.getTimeBlocksByTimeTableId(loginUser, timeTableId);
    }

    @Override 
    @Transactional(readOnly = true)
    public List<TimeBlock>  getHoldBlocks(int loginUser){
        return mapper.getHeldTimeBlocks(loginUser);
    }

    @Override
    public int register(int loginUser, TimeBlock timeBlock){
        timeBlock.setUserId(loginUser);
        int insertRows = mapper.insertTimeBlock(timeBlock);

        if (insertRows != 1){
            throw new TimeBlockReferenceNotFoundException(
                "参照先のタイムテーブルまたはスケジュールは存在しません"
            );
        }

        return timeBlock.getId();
    }

    @Override
    public boolean update(int loginUser, TimeBlock timeBlock){
        int updateRows = mapper.updateTimeBlock(loginUser, timeBlock);
        return updateRows == 1;
    }

    @Override
    public boolean delete(int loginUser, int id){
        int deleteRows = mapper.deleteTimeBlock(id, loginUser);
        return deleteRows == 1;
    }
}
