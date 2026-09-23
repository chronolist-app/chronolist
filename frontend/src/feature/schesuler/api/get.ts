import CalendarEvent from "../entity/calendarEvent";
import { customizedFetch } from "@/hooks/fetch";
import type { ScheduleKind } from "../types/statics";
import { AxiosError } from "axios";
import { ApiError } from "@/error/common";
import { fromDateString, fromDateTimeString, toDateString } from "@/utils/date";
import type { DateString, DateTimeString } from "@/types/date";

type CalendarEventJSON = {
    id: number;
    kind: ScheduleKind;
    startDate?: DateString;
    endDate?: DateString;
    startAt?: DateTimeString;
    endAt?: DateTimeString;
    title: string;
    color: string;
    scheduleId?: number;
    memo?: string;
}

export const getCalendarEvents = async (start: string | Date, end: string | Date): Promise<CalendarEvent[]> => {
    try {
        const res = await customizedFetch<CalendarEventJSON[]>({
            url: `/scheduler/getEvents/${typeof start === "string" ? start : toDateString(start)}/${typeof end === "string" ? end : toDateString(end)}`,
            method: "GET",
        });
        if (res === null) return [];
        return res.map(res => {
            const startValue = res.kind === "ALL_DAY" ? res.startDate : res.startAt;
            const endValue = res.kind === "ALL_DAY" ? res.endDate : res.endAt;
            if (!startValue || !endValue) throw new Error("Event date values are invalid.");

            return new CalendarEvent(
                res.id,
                res.kind,
                res.kind === "ALL_DAY" ? fromDateString(startValue) : fromDateTimeString(startValue),
                res.kind === "ALL_DAY" ? fromDateString(endValue) : fromDateTimeString(endValue),
                res.title,
                res.color,
                res.scheduleId,
                res.memo,
            );
        })
    } catch (err: unknown) {
        if (err instanceof AxiosError) {
            throw new ApiError("何らかのAPIエラーが発生", err.status, { cause: err });
        }
        throw err;
    }
};