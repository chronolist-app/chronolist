import type { CalendarEventApi } from "@/feature/schesuler/types/api";
import useFetch from "@/utils/fetch";
import { useMemo, type FC } from "react"
import ErrorDisplay from "../error";
import classNames from "classnames";


const GetEventsResults = () => {

    /**
     * サーバーに送信するデータ
     */
    const body = useMemo(() => {
        return {
            start: "2025-10-01",
            end: "2025-11-30",
        };
    }, []);

    const {data, isLoading, error} = useFetch<CalendarEventApi[]>(
        `scheduler/getEvents/${body.start}/${body.end}`,
        "GET",
    );

    if (isLoading) return (
        <h1>Loading...</h1>
    );

    if (error) return (
        <>
            <Body {...body} />
            <ErrorDisplay err={error} />
        </>
    );

    return (
        <>
            <Body {...body} />
            <h1>Completed!</h1>
            <div className={classNames("d-flex", "flex-column")}>
                {data? data.map(ce => <CE {...ce} />): "No Data"}
            </div>
        </>
    )

};

const Body: FC<{start: string, end: string}> = ({start, end}) => {
    return (
        <>
            <h1>Submitted data</h1>
            <div>start: {start}</div>
            <div>end: {end}</div>
        </>
    )
};

const CE: FC<CalendarEventApi> = ({
    id,
    kind,
    startAt,
    endAt,
    startDate,
    endDate,
    title,
    color,
    memo,
}) => {
    return (
        <div className={classNames("m-2", "border", "border-2", "border-blue", "d-flex", "flex-column")}>
            <div>id: {id}</div>
            <div>kind: {kind}</div>
            <div>startAt: {startAt || "null"}</div>
            <div>endAt: {endAt || "null"}</div>
            <div>startDate: {startDate || "null"}</div>
            <div>endDate: {endDate || "null"}</div>
            <div>title: {title}</div>
            <div>color: {color}</div>
            <div>memo: {memo || "null"}</div>
        </div>
    );
};

export default GetEventsResults;
