import CalendarEvent from "../entity/calendarEvent";
import { customizedFetch } from "@/hooks/fetch";
import type { ScheduleKind } from "../types/statics";
import { AxiosError } from "axios";
import { ApiError } from "@/error/common";

type CalendarEventJSON = {
    id: number;
    kind: ScheduleKind;
    startDate?: string;
    endDate?: string;
    startAt?: string;
    endAt?: string;
    title: string;
    color: string;
    scheduleId?: number;
    memo?: string;
}

export const getCalendarEvents = async (start: string | Date, end: string | Date): Promise<CalendarEvent[]> => {
    try {
        const res = await customizedFetch<CalendarEventJSON[]>({
            url: `/scheduler/getEvents/${new Date(start).toISOString().split("T")[0]}/${new Date(end).toISOString().split("T")[0]}`,
            method: "GET",
        });
        if (res === null) return [];
        return res.map(res => {
            return new CalendarEvent(
                res.id,
                res.kind,
                new Date(res.startDate ?? res.startAt ?? ""),
                new Date(res.endDate ?? res.endAt ?? ""),
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