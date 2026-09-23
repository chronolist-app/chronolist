import { type ScheduleApi } from "../types/api";
import { type ScheduleSource } from "../types/scheduleSourceType";
import { fromDateString, fromDateTimeString } from "@/utils/date";

export const toScheduleSource = (api: ScheduleApi): ScheduleSource => {
    return {
        id: api.id,
        kind: api.kind,
        startAt: api.startAt ? fromDateTimeString(api.startAt) : null,
        endAt: api.endAt ? fromDateTimeString(api.endAt) : null,
        startDate: api.startDate ? fromDateString(api.startDate) : null,
        endDate: api.endDate ? fromDateString(api.endDate) : null,
        title: api.title,
    };
};