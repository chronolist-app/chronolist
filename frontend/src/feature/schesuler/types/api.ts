import type { ScheduleKind } from "./statics"
import type { DateString, DateTimeString } from "@/types/date";

export type CalendarEventApi = {
    id: number,
    scheduleId: number | null,
    kind: ScheduleKind,
    startAt: DateTimeString | null,
    endAt: DateTimeString | null,
    startDate: DateString | null,
    endDate: DateString | null,
    title: string,
    color: string,
    memo: string | null,
};

export type RegisterApi = {
    kind: ScheduleKind,
    startAt: DateTimeString | null,
    endAt: DateTimeString | null,
    startDate: DateString | null,
    endDate: DateString | null,
    title: string,
    color: string,
    memo: string | null,
};

export type ScheduleApi = {
    id: number,
    kind: ScheduleKind,
    startAt: DateTimeString | null,
    endAt: DateTimeString | null,
    startDate: DateString | null,
    endDate: DateString | null,
    title: string,
};