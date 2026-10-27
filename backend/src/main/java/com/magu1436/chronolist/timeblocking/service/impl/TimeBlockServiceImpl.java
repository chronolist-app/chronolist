package com.magu1436.chronolist.timeblocking.service.impl;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockReferenceNotFoundException;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;
import com.magu1436.chronolist.timeblocking.entity.TimeTable;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper;
import com.magu1436.chronolist.timeblocking.mapper.TimeTableMapper;
import com.magu1436.chronolist.scheduler.entity.Schedule;
import com.magu1436.chronolist.scheduler.mapper.SchedulerMapper;
import com.magu1436.chronolist.timeblocking.service.TimeBlockService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class TimeBlockServiceImpl implements TimeBlockService {
    
    private final TimeBlockMapper mapper;
    private final SchedulerMapper schedulerMapper;
    private final TimeTableMapper timeTableMapper;

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
        if(updateRows != 1){
            return false;
        }
        if(timeBlock.getRelatedSchedule() == null){
            return true;
        }else{
            Schedule updateSchedule = timeBlock.getRelatedSchedule();
            TimeTable relatedTimeTable = timeTableMapper.getTimeTableById(loginUser, timeBlock.getTimeTableId());
            LocalDateTime scheduleStartTime = LocalDateTime.of(relatedTimeTable.getDate(), timeBlock.getStartAt());
            LocalDateTime scheduleEndTime = scheduleStartTime.plusMinutes(timeBlock.getWidth());
            updateSchedule.setTitle(timeBlock.getTitle());
            updateSchedule.setStartAt(scheduleStartTime);
            updateSchedule.setEndAt(scheduleEndTime);
            updateSchedule.setUserId(loginUser);
            int updateScheduleRows = schedulerMapper.updateSchedule(updateSchedule);
            if(updateScheduleRows==1){
                return true;
            }else{
                throw new RuntimeException("関連スケジュールの更新に失敗");
            }
        }
    }

    @Override 
    public boolean updateStartAt(int loginUser, int id, LocalTime startAt){
        int updateRows = mapper.updateTimeBlockStartAt(loginUser, id, startAt);
        return updateRows == 1;
    }

    @Override
    public boolean delete(int loginUser, int id){
        TimeBlock deleteTimeBlock = mapper.getTimeBlockById(id, loginUser);
        if(deleteTimeBlock == null){
            return false;
        }
        int deleteRows = mapper.deleteTimeBlock(id, loginUser);
        if(deleteRows!=1){
            return false;
        }
        if(deleteTimeBlock.getRelatedSchedule() != null &&
                schedulerMapper.deleteSchedule(deleteTimeBlock.getRelatedSchedule().getId(), loginUser) != 1){
            throw new RuntimeException("関連スケジュールの削除に失敗");
        }
        return true;
    }
}
