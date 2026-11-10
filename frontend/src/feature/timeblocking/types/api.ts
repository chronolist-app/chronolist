import type { TimeBlockStatus } from "./statics"
import type { DateString } from "@/types/date";


export type TimeBlockApi = {
    id: number,
    timeTableId: number | null,
    title: string,
    status: TimeBlockStatus,
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
