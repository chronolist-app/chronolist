import { customizedFetch } from "@/hooks/fetch"
import type { ToDoTask } from "@/feature/todolist/types/todotask";
import { toToDoTaskApiFormat } from "./mapper";

/**
 * タスクの更新を行うAPI
 * @param updatedTask 更新したいタスク
 */
export const updateTask = (updatedTask: ToDoTask) => {
    customizedFetch<ToDoTask>({
        url: "/todolist/update",
        method: "PUT",
        data: toToDoTaskApiFormat(updatedTask),
    });
};

/**
 * タスクの完了状況を更新するAPI
 * @param id タスクのID
 * @param isCompleted 更新後の完了状況
 */
export const updateStatus = (id: number, isCompleted: boolean) => {
    customizedFetch<ToDoTask>({
        url: "/todolist/update/status",
        method: "PUT",
        data: { id, isCompleted },
    });
};