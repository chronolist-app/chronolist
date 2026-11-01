import { type FC, useContext, useCallback } from "react";
import classNames from "classnames";

import type { ToDoLabelProps } from "@/feature/todolist/types/props";
import { ToDoLabelCellClassName } from "@/feature/todolist/statics/todolabel-statics";
import CheckBox from "@/components/checkbox";
import PriorityDisplayText from "./priority-display-text";
import { updateStatus } from "@/feature/todolist/api/update-api";
import DueDisplayText from "./due-display-text";
import { SelectedToDoTaskContext } from "../selected-todotask-context";
import AllToDoTasksContext from "../all-todotasks-context";

import "@/feature/todolist/assets/todolabel.css";


const ToDoLabelClassName = "todolabel";

/**
 * ToDoリストの1行を表示するコンポーネント。
 * チェックボックス操作で完了状態を切り替える。
 */
const ToDoLabel: FC<ToDoLabelProps> = ({ toDoTask }) => {
    const { updateTask } = useContext(AllToDoTasksContext);

    /**
     * チェックボックスの変更に合わせてタスク情報を更新する
     * @param checked チェック状態
     */
    const handleCheckboxChange = (checked: boolean) => {
        updateTask({ ...toDoTask, isCompleted: checked }, false);
        updateStatus(toDoTask.id, checked);
    };

    const { id: selectedTaskId, set } = useContext(SelectedToDoTaskContext);

    /**
     * このラベルがクリックされた際に, 選択中のタスクをこのラベルが持つタスクに更新する。
     */
    const handleLabelClick = useCallback(() => {
        if (!set) throw new Error("[chronolist]function 'set' is undefined.");
        set(toDoTask.id);
    }, []);

    return (
        <div className={classNames(ToDoLabelClassName, (toDoTask.id === selectedTaskId) && "selected-label", "d-flex")} onClick={ handleLabelClick }>
            <div className={classNames(ToDoLabelCellClassName.checkbox, "p-2", "border")}>
                <CheckBox
                    defaultChecked={toDoTask.isCompleted}
                    onChange={handleCheckboxChange}
                />
            </div>
            <div className={classNames(ToDoLabelCellClassName.title, toDoTask.isCompleted && "text-decoration-line-through", "p-2", "border")}>
                {toDoTask.title}
            </div>
            <div className={classNames(ToDoLabelCellClassName.priority, toDoTask.isCompleted && "text-decoration-line-through", "p-2", "border")}>
                <PriorityDisplayText priority={toDoTask.priority} />
            </div>
            <div className={classNames(ToDoLabelCellClassName.due, toDoTask.isCompleted && "text-decoration-line-through", "p-2", "border")}>
                <DueDisplayText
                    dueKind={toDoTask.dueKind}
                    dueDate={toDoTask.dueDate?.toDisplayString() || null}
                    dueTime={toDoTask.dueTime?.toString() || null}
                />
            </div>
        </div>
    );
};

export default ToDoLabel;
