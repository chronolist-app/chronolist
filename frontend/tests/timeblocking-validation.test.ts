import test from "node:test";
import assert from "node:assert/strict";
import { Time } from "../src/utils/time.ts";
import { getBlockValidationError, isValidUiBlockWidth, isValidBlockWidth, getBlockDisplayWidth } from "../src/feature/timeblocking/utils/blockValidation.ts";
import { getTimeBlockLayout } from "../src/feature/timeblocking/utils/timeBlockLayout.ts";
test("幅の整数境界と有限性を検証する", () => {
    for (const width of [1, 61, 1440]) assert.equal(isValidBlockWidth(width), true);
    for (const width of [0, -1, 0.5, 1441, NaN, Infinity, -Infinity]) {
        assert.equal(isValidBlockWidth(width), false);
        assert.equal(getBlockDisplayWidth(width), 15);
    }
});
test("23:59の1分は受理し、24:00開始・日またぎ・負の逆算開始を拒否する", () => {
    const check = (start: number, width: number) => getBlockValidationError({ status: "PLACED", width, startAt: new Time(start) });
    assert.equal(check(1439, 1), null);
    assert.equal(check(0, 1440), null);
    for (const [start, width] of [[1440,1],[1441,1],[1439,2],[-1,60]]) assert.ok(check(start,width));
});
test("不正幅と既存の日またぎデータを変更せず表示可能にする", () => {
    const blocks = [NaN, Infinity, -1, 0, 1441, 60].map((width, i) => ({ width, status: "PLACED" as const, startAt: new Time(1410), timeTableId: 1, clientId: String(i), title: "既存", tasks: [], color: "red" }));
    const layout = getTimeBlockLayout(blocks);
    assert.equal(layout.length, blocks.length);
    assert.deepEqual(layout.map(item => [item.columnIndex, item.columnCount]), [[0,6],[1,6],[2,6],[3,6],[4,6],[5,6]]);
    const nextDay = { ...blocks[5], startAt: new Time(1470), clientId: "later" };
    assert.equal(getTimeBlockLayout([...blocks, nextDay]).length, blocks.length);
    assert.ok(Number.isNaN(blocks[0].width));
    assert.equal(blocks[5].width, 60);
});

test("不正幅で後続の衝突グループを汚染しない", () => {
    const make = (width: number, start: number, clientId: string) => Object.freeze({ width, startAt: new Time(start), status: "PLACED" as const, timeTableId: 1, clientId, title: "既存", tasks: [], color: "red" });
    for (const width of [NaN, Infinity, 0, -1, 1441]) {
        const invalid = make(width, 540, "invalid");
        const blocks = [invalid, make(30, 600, "first"), make(30, 615, "second"), make(30, 660, "last")];
        assert.deepEqual(getTimeBlockLayout(blocks).map(item => [item.block.clientId, item.columnIndex, item.columnCount]), [["invalid",0,1],["first",0,2],["second",1,2],["last",0,1]]);
        assert.ok(Object.is(invalid.width, width));
    }
});

test("画面入力はスロット倍数、APIの幅規則は整数分を許容する", () => {
    assert.equal(isValidUiBlockWidth(30, 30), true);
    assert.equal(isValidUiBlockWidth(1440, 30), true);
    assert.equal(isValidUiBlockWidth(1, 30), false);
    assert.equal(isValidUiBlockWidth(61, 30), false);
    assert.equal(isValidBlockWidth(61), true);
});
