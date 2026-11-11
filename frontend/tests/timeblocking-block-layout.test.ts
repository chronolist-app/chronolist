import test from "node:test";
import assert from "node:assert/strict";
import { Time } from "../src/utils/time.ts";
import type { TimeBlockSource } from "../src/feature/timeblocking/types/blockSourceTypes.ts";
import { getTimeBlockLayout } from "../src/feature/timeblocking/utils/timeBlockLayout.ts";

const block = (clientId: string, start: number, end: number): TimeBlockSource => ({
    clientId, startAt: new Time(start * 60), width: (end - start) * 60,
    status: "PLACED", timeTableId: 1, title: clientId, tasks: [], color: "",
});
const positions = (blocks: TimeBlockSource[]) => getTimeBlockLayout(blocks)
    .map(({ block, columnIndex, columnCount }) => [block.clientId, columnIndex, columnCount]);

test("長いブロック内で離れた短いブロックを同一グループの同じ列に置く", () => {
    const blocks = [block("C", 13, 14), block("A", 10, 15), block("B", 11, 12)];
    const original = [...blocks];
    assert.deepEqual(positions(blocks), [["A", 0, 2], ["B", 1, 2], ["C", 1, 2]]);
    assert.deepEqual(blocks, original);
});

test("連鎖した衝突を最大同時重複数の二列に置き、終了済みの列を再利用する", () => {
    assert.deepEqual(positions([
        block("A", 9, 11), block("B", 10, 12), block("C", 11, 13), block("D", 12, 14),
    ]), [["A", 0, 2], ["B", 1, 2], ["C", 0, 2], ["D", 1, 2]]);
});

test("同時開始と入れ子があるグループを最大同時重複数の三列に置く", () => {
    assert.deepEqual(positions([
        block("A", 9, 15), block("B", 9, 12), block("C", 10, 11), block("D", 12, 14),
    ]), [["A", 0, 3], ["B", 1, 3], ["C", 2, 3], ["D", 1, 3]]);
});

test("境界で接するブロックと離れたグループはそれぞれの列数で配置する", () => {
    assert.deepEqual(positions([
        block("A", 9, 11), block("B", 10, 11), block("C", 11, 12), block("D", 14, 15),
    ]), [["A", 0, 2], ["B", 1, 2], ["C", 0, 1], ["D", 0, 1]]);
    assert.deepEqual(positions([]), []);
});

test("PLACEDかつ日内の有効な開始時刻だけを配置し、元データを変更しない", () => {
    const blocks = [
        { ...block("保留", 10, 12), status: "HOLD" as const },
        { ...block("未指定", 10, 12), startAt: null },
        block("負数", -1, 12), block("翌日", 24, 25), block("不正", NaN, 12),
        block("先頭", 0, 1), block("末尾", 23, 24),
    ];
    for (const item of blocks) Object.freeze(item);
    Object.freeze(blocks);
    assert.deepEqual(positions(blocks), [["先頭", 0, 1], ["末尾", 0, 1]]);
});
