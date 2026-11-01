import { customizedFetch } from "@/hooks/fetch";
import type CalendarEvent from "../entity/calendarEvent";
import type { ScheduleKind } from "../types/statics";
import { AxiosError } from "axios";
import { ApiError } from "@/error/common";
import { toDateString, toDateTimeString } from "@/utils/date";
import type { DateString, DateTimeString } from "@/types/date";

type SubmitJSON = {
    kind: ScheduleKind,
    startAt: DateTimeString | null,
    endAt: DateTimeString | null,
    startDate: DateString | null,
    endDate: DateString | null,
    title: string,
    color: string,
    memo: string | null
}

const registerEvent = async (event: CalendarEvent): Promise<number> => {
    const data: SubmitJSON = {
        kind: event.kind,
        startAt: event.startAt ? toDateTimeString(event.startAt) : null,
        endAt: event.endAt ? toDateTimeString(event.endAt) : null,
        startDate: event.startDate ? toDateString(event.startDate) : null,
        endDate: event.endDate ? toDateString(event.endDate) : null,
        title: event.title,
        color: event.color,
        memo: event.memo || null
    }
    try {
        const res = await customizedFetch<number>({
            url: `/scheduler/register`,
            method: "POST",
            data
        });
        return res;
    } catch (err: unknown) {
        if (err instanceof AxiosError) {
            throw new ApiError("何らかのAPIエラーが発生", err.status, { cause: err });
        }
        throw err;
    }
};

export default registerEvent;