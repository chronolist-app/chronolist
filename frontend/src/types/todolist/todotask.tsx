import type { DueDate, DueTime } from "@/feature/todolist/entity/due-entities";
import type { DueKind, Priority } from "./statics";

export interface ToDoTask {
    id: number,
    title: string,
    dueKind: DueKind,
    dueDate: DueDate | null,
    dueTime: DueTime | null,
    priority: Priority,
    isCompleted: boolean,
    memo?: string,
};