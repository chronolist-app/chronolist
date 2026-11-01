import type { RegisterApi } from "@/types/todolist/api"
import useFetch from "@/utils/fetch";
import { useMemo, type FC } from "react";


const RegisterResult = () => {

    /**
     * 作成するテストデータ.  
     * ここを変更することで好きなデータを登録可能.  
     */
    const body: RegisterApi = useMemo(() => {
        return ({
            title: "new task title",
            dueKind: "DATED",
            dueDate: "2025-10-31",
            dueTime: null,
            priority: "MIDDLE",
            isCompleted: false,
            memo: "This is a test memo.",
        });
    }, []);

    const {data, isLoading, error} = useFetch<number>("todolist/register", "POST", body);

    if (isLoading) return (
        <h1>Loading...</h1>
    );

    if (error) return (
        <>
            <div>
                <h1>渡した値</h1>
                <Body {...body} />
            </div>
            <div>
                <h1>Some error happend!</h1>
                <div>{error.name}</div>
                <div>{error.message}</div>
                <div>{error.stack}</div>
            </div>
        </>
    );

    return (
        <>
            <div>
                <h1>渡した値</h1>
                <Body {...body} />
            </div>
            <div>
                <h1>受け取ったID</h1>
                <div>id: {data}</div>
            </div>
        </>
    )
}

const Body: FC<RegisterApi> = ({title, dueKind, dueDate, dueTime, priority, isCompleted, memo}) => {
    return (
        <>
            <div>title: {title}</div>
            <div>dueKind: {dueKind}</div>
            <div>date: {dueDate || "null"}</div>
            <div>time: {dueTime || "null"}</div>
            <div>priority: {priority}</div>
            <div>isCompleted: {isCompleted}</div>
            <div>memo: {memo || "null"}</div>
        </>
    );
}

export default RegisterResult;