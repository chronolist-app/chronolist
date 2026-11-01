import type { RegisterApi } from "@/feature/schesuler/types/api"
import useFetch from "@/utils/fetch";
import ErrorDisplay from "../error";
import type { FC } from "react";
import classNames from "classnames";


const RegisterResult = () => {

    /**
     * 送信するデータ
     */
    const body: RegisterApi = {
        kind: "ALL_DAY",
        startAt: null,
        endAt: null,
        startDate: "2025-11-04",
        endDate: "2025-11-06",
        title: "new schedule",
        color: "blue",
        memo: null,
    };

    const {data, isLoading, error} = useFetch<number>(
        "scheduler/register",
        "POST",
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
            <div>id: {data}</div>
        </>
    )
};

const Body: FC<RegisterApi> = ({
    kind,
    startAt,
    endAt,
    startDate,
    endDate,
    title,
    color,
    memo,
}) => {
    return(
        <div className={classNames("m-2", "d-flex", "flex-column")}>
            <h1>Submitted Data</h1>
            <div>kind: {kind}</div>
            <div>startAt: {startAt || "null"}</div>
            <div>endAt: {endAt || "null"}</div>
            <div>starDate: {startDate || "null"}</div>
            <div>endDate: {endDate || "null"}</div>
            <div>title: {title}</div>
            <div>color: {color}</div>
            <div>memo: {memo || "null"}</div>
        </div>
    );
};

export default RegisterResult;