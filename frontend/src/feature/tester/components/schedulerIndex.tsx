import { useMemo, useState, type ReactNode } from "react"
import { Button } from "react-bootstrap";
import GetEventsResults from "./scheduler/getEvents";
import RegisterResult from "./scheduler/register";
import UpdateResult from "./scheduler/Update";
import DeleteResult from "./scheduler/delete";


const SchedulerTestPage = () => {
    const [apiResult, setApiResult] = useState<ReactNode>();

    const apis: Tester[] = useMemo(() => [
        {
            name: "特定期間のカレンダーイベント取得API",
            url: "api/scheduler/getEvents",
            node: <GetEventsResults />,
        },
        {
            name: "予定登録API",
            url: "api/scheduler/register",
            node: <RegisterResult />
        },
        {
            name: "予定更新API",
            url: "api/scheduler/update",
            node: <UpdateResult />,
        },
        {
            name: "予定削除API",
            url: "api/scheduler/delete/{id}",
            node: <DeleteResult />
        },
    ], []);

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
    )
}

type Tester = {
    name: string,
    url: string,
    node: ReactNode,
}

export default SchedulerTestPage;