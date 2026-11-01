import type { UpdateApi } from "@/types/todolist/api"
import useFetch from "@/utils/fetch";
import { useMemo, type FC } from "react"


const UpdateResult = () => {

    /**
     * 更新するテストデータ.
     */
    const body: UpdateApi = useMemo(() => {
        return {
            id: 0,
            title: "An updated task",
            dueKind: "DATED",
            dueDate: "2025-11-02",
            dueTime: null,
            priority: "HIGH",
            isCompleted: false,
            memo: "This is a test memo.",
        };
    }, []);

    const {isLoading, error} = useFetch(
        "todolist/update",
        "PUT",
        body,
    );

    if (isLoading) return (
        <h1>Loding...</h1>
    );

    if (error) return (
        <>
            <Body {...body} />
            <h1>Some error happened!</h1>
            <div>{error.name}</div>
            <div>{error.message}</div>
            <div>{error.stack}</div>
        </>
    );

    return (
        <>
            <Body {...body} />
            <h1>Updated completely!!</h1>
        </>
    );
};

const Body: FC<UpdateApi> = (prop) => {
    return (
        <>
            <h1>新しいToDoタスクデータ</h1>
            <div>id: {prop.id}</div>
            <div>title: {prop.title}</div>
            <div>dueKind: {prop.dueKind}</div>
            <div>date: {prop.dueDate || "null"}</div>
            <div>time: {prop.dueTime || "null"}</div>
            <div>priority: {prop.priority}</div>
            <div>isCompleted: {prop.isCompleted || "false"}</div>
            <div>memo: {prop.memo || "null"}</div>
        </>
    )
};

export default UpdateResult;