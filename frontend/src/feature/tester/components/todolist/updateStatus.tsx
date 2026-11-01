import type { UpdateStatusApi } from "@/types/todolist/api"
import useFetch from "@/utils/fetch";
import { useMemo, type FC } from "react"


const UpdateStatusResult = () => {

    /**
     * サーバーに渡すデータ
     */
    const body: UpdateStatusApi = useMemo(() => {
        return {
            id: 0,
            isCompleted: true,
        };
    }, []);

    const {isLoading, error} = useFetch("todolist/update/status", "PUT", body);

    if (isLoading) return (<h1>Loading...</h1>);

    if (error) return (
        <>
            <Body {...body} />
            <h1>Some error happend!</h1>
            <div className="m-2">{error.message}</div>
            <div className="m-2">{error.stack}</div>
            <div className="m-2">{error.name}</div>
        </>
    );

    return (
        <>
            <Body {...body} />
            <h1>Update completed!</h1>
        </>
    );
};

const Body: FC<UpdateStatusApi> = ({id, isCompleted}) => {
    return (
        <div>
            <h1>渡したデータ</h1>
            <div>id: {id}</div>
            <div>isCompleted: {isCompleted}</div>
        </div>
    );
};

export default UpdateStatusResult;