import type { DueKind, Priority } from "./statics"
import type { DateString } from "@/types/date";

export type GetAllApi = {
    id: number,
    title: string,
    dueKind: DueKind,
    dueDate: DateString | null,
    dueTime: string | null,
    priority: Priority,
    isCompleted: boolean,
    memo: string | null,
};

export type RegisterApi = {
    title: string,
    dueKind: DueKind,
    dueDate: DateString | null,
    dueTime: string | null,
    priority: Priority,
    isCompleted: boolean,
    memo: string | null,
};

export type UpdateApi = GetAllApi;

export type UpdateStatusApi = {
    id: number,
    isCompleted: boolean,
};