package com.magu1436.chronolist.timeblocking.entity;

/**
 * タイムブロッキング機能におけるブロックの状態を表す列挙型.
 *
 * <p>各ブロックは {@code PLACED} または {@code HOLD} のいずれかの状態を持つ.
 * <ul>
 *   <li>{@code PLACED} : タイムテーブル上に配置されている状態. 開始時刻（startAt）を必ず保持する. </li>
 *   <li>{@code HOLD}   : 待機状態であり, まだタイムテーブルに配置されていない状態. startAt は必ず {@code null}. </li>
 * </ul>
 *
 * この列挙型は {@link TimeBlock} にて使用され, 
 * ブロックの配置状態を表すために利用される.
 *
 * @author magu1436
 */
public enum TimeBlockStatus {
    PLACED,
    HOLD,
}
