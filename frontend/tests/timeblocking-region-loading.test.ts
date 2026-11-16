import test from "node:test";
import assert from "node:assert/strict";
import { loadRegion } from "../src/feature/timeblocking/utils/load-region.ts";
import type { RegionLoadStatus } from "../src/feature/timeblocking/types/regionLoadTypes.ts";

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

test("未取得はloadingとし、空の取得結果も成功後だけ反映する", async () => {
    const request = deferred<string[]>();
    const statuses: RegionLoadStatus[] = [];
    let blocks: string[] | undefined;
    loadRegion(() => request.promise, value => { blocks = value; }, status => statuses.push(status));
    assert.deepEqual(statuses, ["loading"]);
    assert.equal(blocks, undefined);
    request.resolve([]);
    await settle();
    assert.deepEqual(blocks, []);
    assert.deepEqual(statuses, ["loading", "success"]);
});

test("取得失敗を表示し、再試行ではloadingに戻って成功データを反映する", async () => {
    const statuses: RegionLoadStatus[] = [];
    let blocks: string[] | undefined;
    const apply = (value: string[]) => { blocks = value; };
    const setStatus = (status: RegionLoadStatus) => statuses.push(status);
    loadRegion<string[]>(async () => { throw new Error("取得失敗"); }, apply, setStatus);
    await settle();
    assert.deepEqual(statuses, ["loading", "error"]);
    assert.equal(blocks, undefined);
    const retry = deferred<string[]>();
    loadRegion(() => retry.promise, apply, setStatus);
    assert.equal(statuses.at(-1), "loading");
    retry.resolve(["再取得したブロック"]);
    await settle();
    assert.deepEqual(blocks, ["再取得したブロック"]);
    assert.equal(statuses.at(-1), "success");
});

for (const fails of [false, true]) {
    test(`破棄されたリクエストの遅い${fails ? "失敗" : "成功"}が新しい取得結果を上書きしない`, async () => {
        const old = deferred<string[]>();
        const statuses: RegionLoadStatus[] = [];
        let blocks: string[] | undefined;
        const apply = (value: string[]) => { blocks = value; };
        const setStatus = (status: RegionLoadStatus) => statuses.push(status);
        const cancel = loadRegion(() => old.promise, apply, setStatus);
        await settle();
        cancel();
        loadRegion(async () => ["新しい日付のブロック"], apply, setStatus);
        await settle();
        if (fails) old.reject(new Error("古い取得失敗"));
        else old.resolve(["古い日付のブロック"]);
        await settle();
        assert.deepEqual(blocks, ["新しい日付のブロック"]);
        assert.deepEqual(statuses, ["loading", "loading", "success"]);
    });
}

test("アンマウント後の取得結果を反映しない", async () => {
    const request = deferred<string[]>();
    const statuses: RegionLoadStatus[] = [];
    const cancel = loadRegion(() => request.promise, () => assert.fail("破棄後に反映された"), status => statuses.push(status));
    cancel();
    request.resolve(["ブロック"]);
    await settle();
    assert.deepEqual(statuses, ["loading"]);
});

test("領域ごとの取得状態は他の領域の成功・失敗を待たない", async () => {
    const table = deferred<string[]>();
    const hold = deferred<string[]>();
    const template = deferred<string[]>();
    const statuses: RegionLoadStatus[] = ["loading", "loading", "loading"];
    [table, hold, template].forEach((request, index) => {
        loadRegion(() => request.promise, () => {}, status => { statuses[index] = status; });
    });
    hold.resolve(["HOLD"]);
    template.reject(new Error("テンプレート取得失敗"));
    await settle();
    assert.deepEqual(statuses, ["loading", "success", "error"]);
    table.resolve(["配置済み"]);
    await settle();
    assert.deepEqual(statuses, ["success", "success", "error"]);
});
