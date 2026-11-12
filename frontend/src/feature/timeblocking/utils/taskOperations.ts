import type { TimeBlockSource, TimeBlockTask } from "../types/blockSourceTypes";

export type TaskUpdate = (tasks: TimeBlockTask[]) => TimeBlockTask[];

type TaskApi = {
    register: (task: TimeBlockTask) => Promise<number>;
    update: (task: TimeBlockTask) => Promise<unknown>;
    deleteApi: (id: number) => Promise<unknown>;
};
type TaskOperation =
    | { kind: "add"; task: TimeBlockTask }
    | { kind: "update"; task: TimeBlockTask; title: string }
    | { kind: "delete"; task: TimeBlockTask };

/** タスクだけを元ブロックへ反映し、幅・時刻と他のブロックを保持する。 */
export const reflectBlockTasks = (blocks: TimeBlockSource[], blockId: number, change: TaskUpdate): TimeBlockSource[] =>
    blocks.map(block => block.id === blockId ? { ...block, tasks: change(block.tasks) } : block);

/** 専用APIの成功後だけタスクを反映し、重複操作と破棄後のUI通知を抑止する。 */
export const createTaskOperations = (options: {
    api: TaskApi;
    getTasks: () => TimeBlockTask[];
    commit: (change: TaskUpdate) => void;
    notify: (busy: boolean, error: string | null) => void;
}) => {
    let busy = false;
    let active = true;
    const notify = (error: string | null) => {
        if (active) options.notify(busy, error);
    };
    return {
        setActive(value: boolean) { active = value; },
        async run(operation: TaskOperation): Promise<void> {
            if (busy || !active) return;
            busy = true;
            notify(null);
            const tasks = options.getTasks();
            let error: string | null = null;
            try {
                let change: TaskUpdate;
                if (operation.kind === "add") {
                    const id = await options.api.register(operation.task);
                    const saved = { ...operation.task, id };
                    change = current => current.some(task => task.id === id) ? current : [...current, saved];
                } else {
                    const task = tasks.find(task => task.id === operation.task.id);
                    if (!task?.id) throw new Error("タスクIDがありません。");
                    if (operation.kind === "update") {
                        const updated = { ...task, title: operation.title };
                        await options.api.update(updated);
                        change = current => current.map(item => item.id === task.id
                            ? { ...item, title: operation.title } : item);
                    } else {
                        await options.api.deleteApi(task.id);
                        change = current => current.filter(item => item.id !== task.id);
                    }
                }
                // 選択変更後も、保存に成功した元ブロックのリポジトリを更新する。
                options.commit(change);
            } catch {
                error = "タスクを保存できませんでした。保存済みの内容を表示しています。";
            } finally {
                busy = false;
                notify(error);
            }
        },
    };
};
