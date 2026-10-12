package com.magu1436.chronolist.timeblocking.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.magu1436.chronolist.timeblocking.entity.TimeBlockTask;

/**
 * タイムブロッキングにおける {@link TimeBlockTask} の
 * データベース操作を行う MyBatis マッパー。
 *
 * @author konoma1103
 * @see TimeBlockTask
 */
@Mapper
public interface TimeBlockTaskMapper {

    /**
     * 引数で指定した{@code id}をもつ{@link TimeBlockTask}をデータベースから取得する
     * 
     * @param id 取得する{@link TimeBlockTask}のID
     * @param userId id が指定する TimeBlockTask の所有者を判別するための userId
     */
    TimeBlockTask getTimeBlockTaskById(
        @Param("id") int id,
        @Param("userId") int userId
    );

    /**
     * 新しい{@link TimeBlockTask}をデータベースに登録する。
     * <p>
     * 登録時に生成された ID は、引数の {@link TimeBlockTask} に設定される。
     * </p>
     * 
     * @param userId TimeBlockTask が参照する TimeBlock の所有者を把握するための userId
     * @param timeBlockTask 登録する{@link TimeBlockTask}
     */
    int insertTimeBlockTask(
        @Param("userId") int userId,
        @Param("timeBlockTask") TimeBlockTask timeBlockTask);

    /**
     * DBに登録されている {@link TimeBlockTask} を更新する
     * 
     * @param userId TimeBlockTask が参照する TimeBlock の所有者を把握するための userId
     * @param timeBlockTask 更新する {@link TimeBlockTask}
     * 
     * @return 処理後の更新行数
     */
    int updateTimeBlockTask(
        @Param("userId") int userId,
        @Param("timeBlockTask") TimeBlockTask timeBlockTask
    );

    /**
     * 引数で指定した{@code id}をもつ{@link TimeBlockTask}をデータベースから削除する
     * 
     * @param id 削除する{@link TimeBlockTask}のID
     * @param userId TimeBlockTask が参照する TimeBlock の所有者を把握するための userId
     * 
     * @return 処理後の削除行数
     */
    int deleteTimeBlockTask(
        @Param("id") int id,
        @Param("userId") int userId
    ); 
}
