import type { ScheduleApi } from "@/feature/schesuler/types/api"
import type { TimeBlockStatus } from "./statics"
import type { DateString } from "@/types/date";


export type TimeBlockApi = {
    id: number,
    timeTableId: number,
    title: string,
    status: TimeBlockStatus,
    relatedSchedle: ScheduleApi | null,
    width: number,
    startAt: string | null,
    tasks: TimeBlockTaskApi[],
    color: string
};

export type TimeBlockTaskApi = {
    id: number,
    title: string,
    timeBlockId: number,
};

export type TemplateBlockApi = {
    id: number,
    title: string,
    width: number,
    color: string,
}

export type TimeTableApi = {
    id: number,
    date: DateString,
    timeBlocks: TimeBlockApi[],
}