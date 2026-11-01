import { memo, useContext, type FC } from "react";
import classNames from "classnames";

import ToDoHeader from "./todotable-components/todo-header";
import ToDoLabel from "./todotable-components/todo-label";
import AllToDoTasksContext from "./all-todotasks-context";


const ToDoTableClassName = "todotable";
const TODOTABLE_CLASS_NAMES = classNames(
    ToDoTableClassName, "flex-fill", "p-2",
);

const ToDoTableBodyClassName = "todotable-body";

const MemoizedToDoLabel = memo(ToDoLabel);

/**
 * ToDoリスト全体を表示するテーブルコンポーネント。
 * APIからタスクを取得し、一覧として描画する。
 */
const ToDoTable: FC = () => {
    const { tasks } = useContext(AllToDoTasksContext);

    return (
        <div className={TODOTABLE_CLASS_NAMES}>
            <ToDoHeader />
            <div className={classNames(ToDoTableBodyClassName, "d-flex", "flex-column", "overflow-y-scroll")}>
                {tasks.map(task => (
                    <MemoizedToDoLabel key={task.id} toDoTask={task} />
                ))}
            </div>
        </div>
    );
};

export default ToDoTable;
