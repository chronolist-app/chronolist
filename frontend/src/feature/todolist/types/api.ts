import type { DueKind, Priority } from "@/feature/todolist/types/statics";
import type { DateString } from "@/types/date";

export type ToDoTaskApiFormat = {
    id: number,
    title: string,
    dueKind: DueKind,
    dueDate: DateString | null,
    dueTime: string | null,
    priority: Priority,
    isCompleted: boolean,
    memo: string | null,
};

export type InsertApiFormat = Omit<ToDoTaskApiFormat, "id">;