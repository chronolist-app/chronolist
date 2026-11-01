import { useContext, useState, type FC } from "react";
import { v4 } from "uuid";
import classNames from "classnames";

import { DueDate, DueTime } from "@/feature/todolist/entity/due-entities";
import { DueKindEnum, type DueKind, type Priority, PriorityEnum } from "@/feature/todolist/types/statics";
import { ChronolistModal } from "@/components/modal";
import { type ToDoTask } from "@/feature/todolist/types/todotask"; 
import { SelectedToDoTaskContext } from "../selected-todotask-context";
import AllToDoTasksContext from "../all-todotasks-context";
import { resiterTask } from "@/feature/todolist/api/register-api";
import PullDown from "@/components/pulldown";
import { convertDueKindToDisplayText, convertPriorityToDisplayText } from "../../utils/to-display-text";

const RegisterModal: FC<{show: boolean, setShow: (show: boolean) => void}> = ({show, setShow}) => {

    const DEFAULT_DUE_KIND = DueKindEnum.NONE;
    const DEFAULT_PRIORITY = PriorityEnum.HIGH;

    const { set: setSelectedTaskId } = useContext(SelectedToDoTaskContext);
    const { tasks, setTasks } = useContext(AllToDoTasksContext);

    const [ title, setTitle ] = useState<string>("");
    const [ dueKind, setDueKind ] = useState<DueKind>(DEFAULT_DUE_KIND);
    const [ dueDate, setDueDate ] = useState<string>((new DueDate()).toString());
    const [ dueTime, setDueTime ] = useState<string>((new DueTime()).toString());
    const [ priority, setPriority ] = useState<Priority>(DEFAULT_PRIORITY);

    const handleRegister = async () => {
        const tempId = -1 * Date.now();
        const newTask: ToDoTask = {
            id: tempId,
            title: title,
            dueKind: dueKind,
            dueDate: [DueKindEnum.DATED, DueKindEnum.DATETIME].includes(dueKind) ? new DueDate(dueDate) : null,
            dueTime: dueKind === DueKindEnum.DATETIME ? new DueTime(dueTime) : null,
            priority: priority,
            isCompleted: false,
        };
        setTasks([...tasks, newTask]);
        setSelectedTaskId?.(tempId);
        setShow(false);
        const newId = await resiterTask(newTask);
        setTasks([...tasks.filter(task => task.id !== tempId), {...newTask, id: newId}]);
        setSelectedTaskId?.(newId);
    };

    const formId = v4();

    return (
        <ChronolistModal
            title="新規作成"
            isOpen={show}
            acceptButtonlabel="登録"
            onAccept={handleRegister}
            cancelButtonlabel="キャンセル"
            onCancel={() => setShow(false)}
            onClose={() => setShow(false)}
        >
            <div className={classNames("d-flex", "flex-column")}>
                <label htmlFor={`title-${formId}`}>タスク名</label>
                <input type="text" id={`title-${formId}`} value={title} onChange={(e) => setTitle(e.target.value.trim())}/>

                <label htmlFor={`kind-${formId}`}>期日</label>
                <PullDown
                    items={Object.values(DueKindEnum).map(convertDueKindToDisplayText)}
                    values={Object.values(DueKindEnum)}
                    onChange={(value) => setDueKind(value as DueKind)}
                    formLabel={`kind-${formId}`}
                    defaultValue={DEFAULT_DUE_KIND}
                />

                <input
                    type="date"
                    id={`date-${formId}`}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={dueKind === DueKindEnum.NONE ? "d-none": ""}
                />
                <input
                    type="time"
                    id={`time-${formId}`}
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className={dueKind !== DueKindEnum.DATETIME ? "d-none": ""}
                />

                <label htmlFor={`priority-${formId}`}>優先度</label>
                <PullDown
                    items={Object.values(PriorityEnum).map(convertPriorityToDisplayText)}
                    values={Object.values(PriorityEnum)}
                    onChange={(value) => setPriority(value as Priority)}
                    formLabel={`priority-${formId}`}
                    defaultValue={DEFAULT_PRIORITY}
                />
            </div>
        </ChronolistModal>
    )
}

export default RegisterModal;