import type { DueKind, Priority } from "./statics";
import type { DueDate, DueTime } from "../entity/due-entities";

export interface ToDoTask {
    id: number;
    title: string;
    dueKind: DueKind;
    dueDate: DueDate | null;
    dueTime: DueTime | null;
    priority: Priority;
    isCompleted: boolean;
    memo?: string;
};