import { addDays, nextDate } from "../../../utils/date.ts";

const startOfDay = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

// ローカル暦日を日数として比較し、夏時間による一日の長さの違いを除く。
const calendarDay = (date: Date): number =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;

/** 画面で入力した終了日当日を含むよう、翌日の開始を終了境界にする。 */
export const fromInclusiveAllDayRange = (start: Date, end: Date) => ({
    start: startOfDay(start),
    end: nextDate(startOfDay(end)),
});

/** 時刻付き予定が重なる暦日を終日予定にする。 */
export const fromTimedRange = (start: Date, end: Date) => {
    const startDate = startOfDay(start);
    const endDate = startOfDay(end);
    const exclusiveEnd = end.getTime() === endDate.getTime() ? endDate : nextDate(endDate);

    // 開始・終了が同時刻の場合も、開始日を含む1日分を確保する。
    return {
        start: startDate,
        end: exclusiveEnd > startDate ? exclusiveEnd : nextDate(startDate),
    };
};

/** 開始日が終了境界に達した場合は、元の日数分だけ終了日も移動する。 */
export const adjustAllDayEnd = (start: Date, end: Date, newStart: Date): Date => {
    if (calendarDay(newStart) < calendarDay(end)) return end;
    return addDays(newStart, calendarDay(end) - calendarDay(start));
};
