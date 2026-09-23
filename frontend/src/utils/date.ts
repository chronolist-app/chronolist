

import type { DateString, DateTimeString } from "@/types/date";

// 日付・時刻の各要素をISO形式に合わせて2桁の文字列へ整える。
const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * DateオブジェクトをAPI用の日付文字列に変換する。
 * タイムゾーン変換を行わず、ローカル暦日をそのまま出力する。
 */
export const toDateString = (date: Date): DateString => {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * DateオブジェクトをAPI用のローカル日時文字列に変換する。
 * バックエンドのLocalDateTimeに対応するため、タイムゾーン情報は付けない。
 */
export const toDateTimeString = (date: Date): DateTimeString => {
    return `${toDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * APIの日付文字列をローカル時刻のDateオブジェクトに変換する。
 */
export const fromDateString = (value: DateString): Date => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
};

/**
 * APIのローカル日時文字列をDateオブジェクトに変換する。
 */
export const fromDateTimeString = (value: DateTimeString): Date => {
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute, second = 0] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
};

/**
 * 基準となる日付の翌日の `Date` オブジェクトを作成する。  
 * @param date 基準となる日付
 * @returns 翌日の `Date` オブジェクト
 */
export const nextDate = (date: Date): Date => {
    return addDays(date, 1);
}

/**
 * 基準となる日付の前日の `Date` オブジェクトを作成する。  
 * @param date 基準となる日付
 * @returns 前日の `Date` オブジェクト
 */
export const prevDate = (date: Date): Date => {
    return addDays(date, -1);
}

/**
 * 日付を指定した日数分翌日に変更した `Date` オブジェクトを作成する。
 * @param date 基準となる日付
 * @param days 翌日にする日数
 * @returns 日付をずらした `Date` オブジェクト
 */
export const addDays = (date: Date, days: number): Date => {
    const addedDate = new Date(date.valueOf());
    addedDate.setDate(addedDate.getDate() + days);
    return addedDate;
};