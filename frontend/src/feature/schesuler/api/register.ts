import { customizedFetch } from "@/hooks/fetch";
import type CalendarEvent from "../entity/calendarEvent";
import type { ScheduleKind } from "../types/statics";
import { AxiosError } from "axios";
import { ApiError } from "@/error/common";

type SubmitJSON = {
    kind: ScheduleKind,
    startAt: string | null,
    endAt: string | null,
    startDate: string | null,
    endDate: string | null,
    title: string,
    color: string,
    memo: string | null
}

export const registerEvent = async (event: CalendarEvent): Promise<number> => {
    const data: SubmitJSON = {
        kind: event.kind,
        startAt: event.startAt ? event.startAt.toISOString().split("T")[0] : null,
        endAt: event.endAt ? event.endAt.toISOString().split("T")[0] : null,
        startDate: event.startDate ? event.startDate.toISOString().split("T")[0] : null,
        endDate: event.endDate ? event.endDate.toISOString().split("T")[0] : null,
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
}