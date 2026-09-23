import { ApiError } from "@/error/common";
import { customizedFetch } from "@/hooks/fetch";
import type { DateString, DateTimeString } from "@/types/date";
import { toDateString, toDateTimeString } from "@/utils/date";
import { AxiosError } from "axios";
import type CalendarEvent from "../entity/calendarEvent";
import type { ScheduleKind } from "../types/statics";

type SubmitJSON = {
    id: number;
    scheduleId: number;
    kind: ScheduleKind;
    startAt: DateTimeString | null;
    endAt: DateTimeString | null;
    startDate: DateString | null;
    endDate: DateString | null;
    title: string;
    color: string;
    memo: string | null;
};

const updateCalendarEvent = async (event: CalendarEvent): Promise<void> => {
    if (event.scheduleId === undefined) {
        throw new Error("Cannot update a calendar event without a scheduleId.");
    }

    const data: SubmitJSON = {
        id: event.id,
        scheduleId: event.scheduleId,
        kind: event.kind,
        startAt: event.startAt ? toDateTimeString(event.startAt) : null,
        endAt: event.endAt ? toDateTimeString(event.endAt) : null,
        startDate: event.startDate ? toDateString(event.startDate) : null,
        endDate: event.endDate ? toDateString(event.endDate) : null,
        title: event.title,
        color: event.color,
        memo: event.memo || null,
    };

    try {
        await customizedFetch<void>({
            url: "/scheduler/update",
            method: "PUT",
            data,
        });
    } catch (err: unknown) {
        if (err instanceof AxiosError) {
            throw new ApiError("予定の更新に失敗しました。", err.status, { cause: err });
        }
        throw err;
    }
};

export default updateCalendarEvent;
