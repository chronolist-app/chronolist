import type { CalendarEventApi } from "@/feature/schesuler/types/api"
import useFetch from "@/utils/fetch";
import type { FC } from "react";
import ErrorDisplay from "../error";


const UpdateResult = () => {

    /**
     * 送信データ
     */
    const body: CalendarEventApi = {
        id: 1,
        title: "updated title",
        kind: "ALL_DAY",
        startAt: null,
        endAt: null,
        startDate: "2025-11-04",
        endDate: "2025-11-04",
        color: "blue",
        memo: null,
    };

    const {isLoading, error} = useFetch(
        "scheduler/update",
        "PUT",
        body,
    );

    if (isLoading) return (<h1>Loading...</h1>);

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
        </>
    );
};

const Body: FC<CalendarEventApi> = ({
    id,
    kind,
    startAt,
    endAt,
    startDate,
    endDate,
    title,
    color,
    memo
}) => {
    return (
        <>
            <h1>Submitted Data</h1>
            <div>id: {id}</div>
            <div>kind: {kind}</div>
            <div>startAt: {startAt || "null"}</div>
            <div>endAt: {endAt || "null"}</div>
            <div>startDate: {startDate || "null"}</div>
            <div>endDate: {endDate || "null"}</div>
            <div>title: {title}</div>
            <div>color: {color}</div>
            <div>memo: {memo || "null"}</div>
        </>
    )
};

export default UpdateResult;
