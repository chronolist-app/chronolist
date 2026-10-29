package com.magu1436.chronolist.timeblocking.mapper;

import java.time.LocalTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.magu1436.chronolist.timeblocking.entity.TimeBlock;

/**
 * タイムブロッキングにおける {@link TimeBlock} の
 * データベース操作を行う MyBatis マッパー。
 *
 * @author magu1436
 * @see TimeBlock
 */
@Mapper
public interface TimeBlockMapper {

    /**
     * 指定した ID の {@link TimeBlock} を取得する。
     *
     * @param id 取得対象の TimeBlock の ID
     * @param userId id で指定している TimeBlock の所有者を判別するための userId
     * 
     * @return 対応する {@link TimeBlock}。存在しない場合は {@code null} を返す。
     */
    TimeBlock getTimeBlockById(
        @Param("id") int id,
        @Param("userId") int userId
    );

    /**
     * 指定した{@code timeTableId}をもつ{@code TimeBlock}を取得する
     * 
     * @param timeTableId 取得対象の{@code timeTableId}
     * @return 対応する{@link TimeBlock}。
     */
    List<TimeBlock> getTimeBlocksByTimeTableId(
        @Param("userId") int userId,
        @Param("timeTableId") int timeTableId);

    /**
     * 指定のユーザーIDをもち, かつステータスが {@code HOLD} の {@link TimeBlock} をすべて取得する。
     * <p>
     * {@code HOLD} はタイムテーブルに配置されていない保持状態のブロックであり、
     * 配置前の素材として表示される。
     * </p>
     *
     * @param userId 取得対象となるユーザーID
     * @return {@code HOLD} 状態の {@link TimeBlock} の一覧。  
     *         該当がない場合でも空のリストを返す。
     */
    List<TimeBlock> getHeldTimeBlocks(int userId);

    /**
     * 新しい {@link TimeBlock} をデータベースに登録する。
     * <p>
     * 登録時に生成された ID は、引数の {@link TimeBlock} に設定される。
     * </p>
     *
     * @param timeBlock 登録する {@link TimeBlock}
     */
    int insertTimeBlock(TimeBlock timeBlock);

    /**
     * 既存の {@link TimeBlock} を更新する。
     * <p>
     * 更新対象は、引数で受け取った {@link TimeBlock} の ID によって特定される。
     * </p>
     *
     * @param userId timeBlock の所有者を判別するためのuserId
     * @param timeBlock 更新内容を保持した {@link TimeBlock}
     */
    int updateTimeBlock(
        @Param("userId") int userId,
        @Param("timeBlock") TimeBlock timeBlock
    );

    int updateTimeBlockStartAt(
        @Param("userId") int userId,
        @Param("id") int id,
        @Param("startAt") LocalTime startAt
    );

    /**
     * 指定した ID の {@link TimeBlock} を削除する。
     *
     * @param id 削除する TimeBlock の ID
     * @param id でしていした TimeBlock の所有者を判別するための userId
     */
    int deleteTimeBlock(
        @Param("id") int id,
        @Param("userId") int userId
    );
}