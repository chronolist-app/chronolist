import { type ScheduleKind } from "./statics";

export type ScheduleSource = {
    id: number,
    kind: ScheduleKind,
    startAt: Date | null,
    endAt: Date | null,
    startDate: Date | null,
    endDate: Date | null,
    title: string,
};