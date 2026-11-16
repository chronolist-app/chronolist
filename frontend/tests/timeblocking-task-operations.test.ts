import test from "node:test";
import assert from "node:assert/strict";
import { createTaskOperations, reflectBlockTasks } from "../src/feature/timeblocking/utils/taskOperations.ts";
import { Time } from "../src/utils/time.ts";
import type { TimeBlockSource, TimeBlockTask } from "../src/feature/timeblocking/types/blockSourceTypes.ts";

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const task = (id = 1): TimeBlockTask => ({ id, clientId: "task" + id, timeBlockId: 7, title: "保存済み" });
const block = (width: number, start: number, id = 7): TimeBlockSource => ({
    id, clientId: "block" + id, title: "ブロック", status: "PLACED", timeTableId: 1,
    width, startAt: new Time(start), tasks: [task()], color: "red",
});

for (const [label, width, start] of [["正常", 30, 540], ["幅不正", 0, 540], ["日またぎ", 60, 1430]] as const) {
    test(label + "ブロックのタスクだけを専用API成功後に追加・編集・削除する", async () => {
        const original = Object.freeze(block(width, start));
        const other = Object.freeze(block(30, 600, 8));
        let repository = [original, other];
        let tasks = original.tasks;
        const calls: string[] = [];
        const registration = deferred<number>();
        const operation = createTaskOperations({
            api: {
                register: async () => { calls.push("register"); return registration.promise; },
                update: async () => { calls.push("update"); },
                deleteApi: async () => { calls.push("delete"); },
            },
            getTasks: () => tasks,
            commit: change => { tasks = change(tasks); repository = reflectBlockTasks(repository, 7, change); },
            notify: () => {},
        });
        const added = Object.freeze({ clientId: "new", timeBlockId: 7, title: "新規" });
        const pending = operation.run({ kind: "add", task: added });
        await operation.run({ kind: "add", task: added });
        assert.equal(tasks.length, 1);
        assert.deepEqual(calls, ["register"]);
        registration.resolve(22);
        await pending;
        assert.equal(tasks[1].id, 22);
        assert.equal("id" in added, false);
        await operation.run({ kind: "update", task: tasks[1], title: "変更" });
        assert.equal(tasks[1].title, "変更");
        await operation.run({ kind: "delete", task: tasks[1] });
        assert.deepEqual(tasks, original.tasks);
        assert.equal(repository[0].width, width);
        assert.equal(repository[0].startAt, original.startAt);
        assert.equal(repository[1], other);
        assert.deepEqual(calls, ["register", "update", "delete"]);
    });
}

for (const kind of ["add", "update", "delete"] as const) {
    test(kind + "失敗時に保存済み内容を保持してエラー通知する", async () => {
        const original = Object.freeze([Object.freeze(task())]);
        let commits = 0;
        const states: [boolean, string | null][] = [];
        const failure = deferred<number>();
        const operation = createTaskOperations({
            api: { register: () => failure.promise, update: () => failure.promise, deleteApi: () => failure.promise },
            getTasks: () => [...original],
            commit: () => { commits++; },
            notify: (busy, error) => states.push([busy, error]),
        });
        const pending = operation.run(kind === "update" ? { kind, task: original[0], title: "未保存" } : { kind, task: original[0] });
        assert.deepEqual(states, [[true, null]]);
        failure.reject(new Error("保存失敗"));
        await pending;
        assert.equal(commits, 0);
        assert.equal(original[0].title, "保存済み");
        assert.equal(states[1][0], false);
        assert.match(states[1][1]!, /保存できません/);
    });
}

test("選択変更・破棄後の完了は元のrepositoryだけを更新し別ブロックの表示を保持する", async () => {
    const a = block(0, 1439);
    const b = block(30, 600, 8);
    let repository = [a, b];
    let selected = a;
    const registration = deferred<number>();
    const states: boolean[] = [];
    const operation = createTaskOperations({
        api: { register: () => registration.promise, update: async () => {}, deleteApi: async () => {} },
        getTasks: () => a.tasks,
        commit: change => {
            repository = reflectBlockTasks(repository, 7, change);
            if (selected.id === 7) selected = { ...selected, tasks: change(selected.tasks) };
        },
        notify: busy => states.push(busy),
    });
    const pending = operation.run({ kind: "add", task: { clientId: "new", timeBlockId: 7, title: "新規" } });
    operation.setActive(false);
    selected = b;
    await operation.run({ kind: "delete", task: a.tasks[0] });
    registration.resolve(12);
    await pending;
    assert.equal(selected, b);
    assert.equal(repository[1], b);
    assert.equal(repository[0].tasks[1].id, 12);
    assert.equal(repository[0].width, 0);
    assert.equal(repository[0].startAt, a.startAt);
    assert.deepEqual(states, [true]);
});

test("待機中に更新された元ブロックのタスクも保持して成功を反映する", async () => {
    let tasks = [task()];
    const registration = deferred<number>();
    const operations = createTaskOperations({
        api: { register: () => registration.promise, update: async () => {}, deleteApi: async () => {} },
        getTasks: () => tasks,
        commit: change => { tasks = change(tasks); },
        notify: () => {},
    });
    const pending = operations.run({ kind: "add", task: { clientId: "pending", timeBlockId: 7, title: "待機中" } });
    tasks = [...tasks, task(44)];
    registration.resolve(55);
    await pending;
    assert.deepEqual(tasks.map(item => item.id), [1, 44, 55]);
});

test("再取得でclientIdが変わっても保存IDで更新・削除する", async () => {
    let tasks = [task()];
    let waiting = deferred<void>();
    const operations = createTaskOperations({
        api: { register: async () => 2, update: () => waiting.promise, deleteApi: () => waiting.promise },
        getTasks: () => tasks,
        commit: change => { tasks = change(tasks); },
        notify: () => {},
    });
    const update = operations.run({ kind: "update", task: tasks[0], title: "更新" });
    tasks = [{ ...tasks[0], clientId: "refetched" }, task(8)];
    waiting.resolve();
    await update;
    assert.equal(tasks[0].title, "更新");
    assert.equal(tasks[0].clientId, "refetched");
    waiting = deferred<void>();
    const deletion = operations.run({ kind: "delete", task: tasks[0] });
    tasks = tasks.map(item => ({ ...item, clientId: item.clientId + "-again" }));
    waiting.resolve();
    await deletion;
    assert.deepEqual(tasks.map(item => item.id), [8]);
});
