import { useState, type ReactNode } from "react";
import { Button } from "react-bootstrap";
import GetAllResult from "./todolist/getall";
import RegisterResult from "./todolist/register";
import UpdateResult from "./todolist/update";
import UpdateStatusResult from "./todolist/updateStatus";
import DeleteResult from "./todolist/delete";


const ToDoListTestPage = () => {
    const [apiResult, setApiResult] = useState<ReactNode>();

    const apis: Tester[] = [
        {
            name: "全タスク取得API",
            url: "api/todolist/getAll",
            node: <GetAllResult />,
        },
        {
            name: "タスク登録API",
            url: "api/todolist/register",
            node: <RegisterResult />,
        },
        {
            name: "タスク更新API",
            url: "api/todolist/update",
            node: <UpdateResult />
        },
        {
            name: "タスク完了状況更新API",
            url: "api/todolist/update/",
            node: <UpdateStatusResult />,
        },
        {
            name: "タスク削除API",
            url: "api/todolist/delete/{id}",
            node: <DeleteResult />,
        },
    ];

    return (
        <>
            {apis.map(tester => {
                return (
                    <Button className="m-2" onClick={() => {setApiResult(
                        <>
                            <h1>アクセスURL</h1>
                            <div className="m-2">{tester.url}</div>
                            {tester.node}
                        </>
                    )}} key={tester.name}>{tester.name}</Button>
                );
            })}
            {apiResult}
        </>
    );
}

type Tester = {
    name: string,
    url: string,
    node: ReactNode,
}

export default ToDoListTestPage;