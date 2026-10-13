package com.magu1436.chronolist.timeblocking.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper;
import com.magu1436.chronolist.timeblocking.service.TimeBlockService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class TimeBlockServiceImpl implements TimeBlockService {
    
    private final TimeBlockMapper timeBlockMapper;

    /**
     * 指定した {@code timeTableId} をもつ {@link TimeBlock} を取得する
     * 
     * @param timeTableId 取得対象の {@code timeTable} のID
     * @return 対応する {@link TimeBlock} のリスト
     */
    public List<TimeBlock> getTimeBlocksByTimeTableId(int userId, int timeTableId) {
        return timeBlockMapper.getTimeBlocksByTimeTableId(userId, timeTableId);
    }
}
