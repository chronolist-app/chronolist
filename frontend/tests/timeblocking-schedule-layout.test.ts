import test from "node:test";
import assert from "node:assert/strict";
import { getScheduleLayout } from "../src/feature/timeblocking/utils/scheduleLayout.ts";

const at = (day: number, hour = 0, minute = 0) => new Date(2026, 2, day, hour, minute);
const timed = (id: string, startAt: Date, endAt: Date) => ({
    id, kind: "DATED" as const, startAt, endAt, startDate: undefined, endDate: undefined,
});
const allDay = (id: string, startDate: Date, endDate: Date) => ({
    id, kind: "ALL_DAY" as const, startDate, endDate, startAt: undefined, endAt: undefined,
});

test("時刻付き予定を表示日の両端で切り詰め、境界に接する予定と空の予定を除外する", () => {
    const { items } = getScheduleLayout([
        timed("前日に終了", at(7, 23), at(8)),
        timed("前日から継続", at(7, 23), at(8, 1, 15)),
        timed("日中", at(8, 9, 30), at(8, 10)),
        timed("同時刻", at(8, 12), at(8, 12)),
        timed("翌日まで継続", at(8, 23, 45), at(9, 1)),
        timed("翌日に開始", at(9), at(9, 1)),
    ], at(8));

    assert.deepEqual(items.map(({ event, startMinute, endMinute }) => [event.id, startMinute, endMinute]), [
        ["前日から継続", 0, 75],
        ["日中", 570, 600],
        ["翌日まで継続", 1425, 1440],
    ]);
});

test("終日予定を終了日を含まない範囲で判定し、表示日全体に配置する", () => {
    const { items } = getScheduleLayout([
        allDay("終了日が表示日", at(7), at(8)),
        allDay("複数日", at(7), at(9)),
        allDay("表示日だけ", at(8), at(9)),
        allDay("翌日から", at(9), at(10)),
    ], at(8));

    assert.deepEqual(items.map(({ event, startMinute, endMinute }) => [event.id, startMinute, endMinute]), [
        ["複数日", 0, 1440],
        ["表示日だけ", 0, 1440],
    ]);
});

test("入れ子や同じ時刻の予定を別の列に置き、終了時刻に接する予定に列を再利用する", () => {
    const { items, laneCount } = getScheduleLayout<ReturnType<typeof timed> | ReturnType<typeof allDay>>([
        timed("入れ子", at(8, 9), at(8, 10)),
        timed("同じ時刻", at(8, 9), at(8, 10)),
        timed("親", at(8, 8), at(8, 12)),
        timed("親の終了と同時", at(8, 12), at(8, 13)),
        allDay("終日", at(8), at(9)),
    ], at(8));

    assert.deepEqual(items.map(({ event, lane }) => [event.id, lane]), [
        ["終日", 0],
        ["親", 1],
        ["入れ子", 2],
        ["同じ時刻", 3],
        ["親の終了と同時", 1],
    ]);
    assert.equal(laneCount, 4);
});
