import test from "node:test";
import assert from "node:assert/strict";
import { adjustAllDayEnd, fromInclusiveAllDayRange, fromTimedRange } from "../src/feature/schesuler/entity/allDayRange.ts";
import { prevDate } from "../src/utils/date.ts";

const date = (day: number, hour = 0) => new Date(2026, 2, day, hour);

test("終日予定の同日入力は翌日を終了境界として保存する", () => {
    const range = fromInclusiveAllDayRange(date(8, 9), date(8, 17));
    assert.deepEqual(range, { start: date(8), end: date(9) });
    assert.deepEqual(prevDate(range.end), range.start);
});

test("時刻付き予定から変換するとき午前0時の終了日は範囲に含めない", () => {
    assert.deepEqual(fromTimedRange(date(7, 23), date(8)), { start: date(7), end: date(8) });
    assert.deepEqual(fromTimedRange(date(7, 23), date(8, 1)), { start: date(7), end: date(9) });
    assert.deepEqual(fromTimedRange(date(8), date(8)), { start: date(8), end: date(9) });
});

test("開始日を終了境界以降に移動すると元の日数を維持する", () => {
    assert.deepEqual(adjustAllDayEnd(date(7), date(9), date(8)), date(9));
    assert.deepEqual(adjustAllDayEnd(date(7), date(9), date(9)), date(11));
    assert.deepEqual(adjustAllDayEnd(date(7), date(9), date(10)), date(12));
});
