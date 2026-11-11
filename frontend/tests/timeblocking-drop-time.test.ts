import test from "node:test";
import assert from "node:assert/strict";
import { getDropStartMinutes } from "../src/feature/timeblocking/utils/dropTime.ts";

const placed = { status: "PLACED" as const, timeTableId: 1 };
const hold = { status: "HOLD" as const, timeTableId: null };
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

test("24:00直前のスロットを受理し、開始時刻が24:00以上なら拒否する", () => {
    for (const source of sources) {
        assert.equal(getDropStartMinutes(1919.9, 20, 15, source, 1), 1425);
        assert.equal(getDropStartMinutes(1920, 20, 15, source, 1), null);
        assert.equal(getDropStartMinutes(1940, 20, 15, source, 1), null);
    }
});
