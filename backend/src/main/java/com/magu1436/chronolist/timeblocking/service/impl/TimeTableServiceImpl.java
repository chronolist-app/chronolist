package com.magu1436.chronolist.timeblocking.service.impl;

import java.time.LocalDate;
import java.util.List;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;
import com.magu1436.chronolist.timeblocking.entity.TimeTable;
import com.magu1436.chronolist.timeblocking.exception.TimeTableConflictException;
import com.magu1436.chronolist.timeblocking.exception.TimeTableNotFoundException;
import com.magu1436.chronolist.timeblocking.mapper.TimeTableMapper;
import com.magu1436.chronolist.timeblocking.service.TimeBlockService;
import com.magu1436.chronolist.timeblocking.service.TimeTableService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class TimeTableServiceImpl implements TimeTableService{
    
    private final TimeTableMapper timeTableMapper;
    private final TimeBlockService timeBlockService;

    /**
     * 指定したユーザーIDと日付をもつタイムテーブルを取得する. <br>
     * 内部で該当タイムテーブルが持つ {@link TimeBlock} も取得する.
     * 
     * @param userId 検索対象のユーザー
     * @param date 検索対象の日付
     * @return 指定した日付に対応する {@link TimeTable}
     * @author magu1436
     * @throws TimeTableNotFoundException 指定の条件に一致する {@link TimeTable} が存在しなかったときに生じる
     */
    public TimeTable getByDate(int userId, LocalDate date) throws TimeTableNotFoundException {
        
        TimeTable table = timeTableMapper.getTimeTableByDate(userId, date);
        if (table == null) {
            throw new TimeTableNotFoundException(String.format("TimeTable was not found. userId: %d, date: %tF", userId, date));
        }

        // DBに該当するブロックがなかった場合には, blocks には空のリストを設定
        List<TimeBlock> blocks = timeBlockService.getTimeBlocksByTimeTableId(userId,table.getId());
        if (blocks == null) {
            blocks = List.of();
        }
        table.setTimeBlocks(blocks);
        return table;
    }

    /**
     * 指定の {@link TimeTable} をDBに登録する. <br>
     * 作成した {@link TimeTable} を返す. この {@link TimeTable} には, DB登録時に生成されたIDを持つ. <br>
     * 既に同一ユーザーIDと日付の組み合わせの {@link TimeTable} が存在する場合, {@link TimeTableConflictException} 例外をスローする.
     * 
     * @param timeTable 登録する {@link TimeTable}
     * @return 作成した {@link TimeTable}
     * @throws TimeTableConflictException 既に同一ユーザーIDと日付の組み合わせの {@link TimeTable} が存在する場合
     * @author magu1436
     */
    public TimeTable createAt(TimeTable timeTable) throws TimeTableConflictException {
        TimeTable inputTable = timeTable.clone();
        if (inputTable.getTimeBlocks() == null) {
            inputTable.setTimeBlocks(List.of());
        }
        try {
            timeTableMapper.insertTimeTable(inputTable);
        } catch (DuplicateKeyException e){
            throw new TimeTableConflictException(String.format("TimeTable already exists. userId: %d, date: %tF", inputTable.getUserId(), inputTable.getDate()));
        }
        return inputTable;
    }
    
    /**
     * 指定のユーザーIDと日付をもつタイムテーブルをDBに登録する.<br>
     * 作成した {@link TimeTable} を返す. この {@link TimeTable} には, DB登録時に生成されたIDを持つ. <br>
     * 既に同一ユーザーIDと日付の組み合わせの {@link TimeTable} が存在する場合, {@link TimeTableConflictException} 例外をスローする.
     * 
     * @param userId テーブルを所有するユーザーのID
     * @param date テーブルの日付
     * @return 作成した {@link TimeTable}
     * @throws TimeTableConflictException 既に同一ユーザーIDと日付の組み合わせの {@link TimeTable} が存在する場合
     * @author magu1436
     */
    public TimeTable createAt(int userId, LocalDate date) throws TimeTableConflictException {
        TimeTable timeTable = new TimeTable();
        timeTable.setUserId(userId);
        timeTable.setDate(date);
        timeTable.setTimeBlocks(List.of());
        
        return this.createAt(timeTable);

    }

}
