import test from "node:test";
import assert from "node:assert/strict";
import { getDropStartMinutes } from "../src/feature/timeblocking/utils/dropTime.ts";

const placed = { width: 60, status: "PLACED" as const, timeTableId: 1 };
const hold = { width: 60, status: "HOLD" as const, timeTableId: null };
const template = { id: 1, clientId: "template", title: "テンプレート", width: 60, color: "cyan" };
const sources = [
    placed,
    hold,
    { ...hold, fromTemplateBlockSource: template },
    { ...placed, fromTemplateBlockSource: template },
    { ...placed, timeTableId: 2 },
];

test("同一表の配置済みブロックだけ負の開始時刻を00:00に補正する", () => {
    for (const offsetTop of [-0.1, -20, -120]) {
        assert.equal(getDropStartMinutes(offsetTop, 20, 15, placed, 1), 0);
        for (const source of sources.slice(1)) {
            assert.equal(getDropStartMinutes(offsetTop, 20, 15, source, 1), null);
        }
    }
});

test("移動元にかかわらず00:00を受理し、座標差を直前のスロットに丸める", () => {
    for (const source of sources) {
        for (const [offsetTop, expected] of [[0, 0], [19.9, 0], [20, 15], [20.1, 15], [720, 540]]) {
            assert.equal(getDropStartMinutes(offsetTop, 20, 15, source, 1), expected);
        }
    }
});

test("同一表だけ終了が24:00以内の最終スロットへ補正する", () => {
    for (const offset of [1919.9, 1920, 1940]) {
        assert.equal(getDropStartMinutes(offset, 20, 15, placed, 1), 1380);
        for (const source of sources.slice(1)) assert.equal(getDropStartMinutes(offset, 20, 15, source, 1), null);
    }
    assert.equal(getDropStartMinutes(1840, 20, 15, hold, 1), 1380);
    assert.equal(getDropStartMinutes(2000, 20, 15, { ...placed, width: 61 }, 1), 1365);
    for (const width of [0, -1, 0.5, 1441, NaN, Infinity])
        assert.equal(getDropStartMinutes(0, 20, 15, { ...placed, width }, 1), null);
});
