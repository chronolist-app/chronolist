package com.magu1436.chronolist.timeblocking.service;

import java.time.LocalDate;

import com.magu1436.chronolist.timeblocking.entity.TimeTable;

public interface TimeTableService {
    
    /**
     * 指定したユーザーIDと日付に対応する{@link TimeTable}を取得する
     * @param userId 検索対象のユーザー
     * @param date 検索対象の日付
     * @return 指定した日付に対応する{@link TimeTable}
     * @author magu1436
     */
    TimeTable getByDate(int userId, LocalDate date);

    /**
     * 指定の {@link TimeTable} をDBに登録する. <br>
     * 作成した {@link TimeTable} を返す. この {@link TimeTable} には, DB登録時に生成されたIDを持つ.
     * @param timeTable
     * @return 作成した {@link TimeTable}
     * @author magu1436
     */
    TimeTable createAt(TimeTable timeTable);

    /**
     * 指定のユーザーIDと日付に対応する {@link TimeTable} を作成し, DBに登録する.
     * 作成した {@link TimeTable} を返す. この {@link TimeTable} には, DB登録時に生成されたIDを持つ.
     * @param userId テーブルを所有するユーザーのID
     * @param date テーブルの日付
     * @return 作成した {@link TimeTable}
     * @author magu1436
     */
    TimeTable createAt(int userId, LocalDate date);
}
