import type { ScheduleSource } from "@/feature/schesuler/types/scheduleSourceType"
import type { TimeBlockStatus } from "./statics"
import type { Time } from "@/utils/time"


export type TimeBlockTask = {
    id?: number,
    clientId: string,
    timeBlockId: number,
    title: string,
};

export type TimeBlockSource = {
    id?: number,
    clientId: string,
    timeTableId: number | null,
    title: string,
    status: TimeBlockStatus,
    relatedSchedle: ScheduleSource | null,
    width: number,
    startAt: Time | null,
    tasks: TimeBlockTask[],
    color: string,
    fromTemplateBlockSource?: TemplateBlockSource,
}

export type TemplateBlockSource = {
    id?: number,
    clientId: string,
    title: string,
    width: number,
    color: string,
}