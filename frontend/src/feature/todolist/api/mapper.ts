import type { ToDoTask } from "@/feature/todolist/types/todotask";
import type { InsertApiFormat, ToDoTaskApiFormat } from "../types/api";


/**
 * ToDoタスクをAPIで一般的に使える形式に変換する関数
 * @param toDoTask 変換したいタスク
 * @returns APIで使用する形式にフォーマットしたオブジェクト
 */
export const toToDoTaskApiFormat = (toDoTask: ToDoTask): ToDoTaskApiFormat => {
    return {
        ...toDoTask,
        dueDate: toDoTask.dueDate ? toDoTask.dueDate.toString() : null,
        dueTime: toDoTask.dueTime ? toDoTask.dueTime.toString() : null,
        memo: toDoTask.memo || null,
    }
};

/**
 * ToDoタスクを新規タスク登録APIで渡す形式に変換する関数
 * @param toDoTask 変換したいタスク
 * @returns APIで登録する形式にフォーマットしたオブジェクト
 */
export const toInsertApiFormat = (toDoTask: ToDoTask): InsertApiFormat => {
    const { id, ...rest } = toToDoTaskApiFormat(toDoTask);
    void id;
    return rest;
};
