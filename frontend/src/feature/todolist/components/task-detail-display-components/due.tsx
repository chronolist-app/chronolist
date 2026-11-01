import classNames from "classnames";
import { useContext } from "react";

import { SelectedToDoTaskContext } from "../selected-todotask-context";
import AllToDoTasksContext from "../all-todotasks-context";
import { type DueKind, DueKindEnum } from "@/feature/todolist/types/statics";
import { DueDate, DueTime } from "@/feature/todolist/entity/due-entities";
import { convertDueKindToDisplayText } from "@/feature/todolist/utils/to-display-text";
import PullDown from "@/components/pulldown";
import CommonTaskDetailDisplayClassNames from "./common-class-names";


// 期日要素固有のクラス名
const TASK_DETAIL_DISPLAY_DUE_CLASS_TAG = "task-detail-display-due";
// 期日要素が持つクラス群
const TASK_DETAIL_DISPLAY_DUE_CLASS_NAMES = classNames(
    TASK_DETAIL_DISPLAY_DUE_CLASS_TAG, 
    CommonTaskDetailDisplayClassNames,
    "d-flex", "flex-column",
);

const Due = () => {
    const { id: selectedTaskId } = useContext(SelectedToDoTaskContext);
    const { tasks, updateTask } = useContext(AllToDoTasksContext);
    const selectedTask = tasks.find(task => task.id === selectedTaskId);

    const handleSelect = (value: string) => {
        if (!selectedTask) return;
        const dueKind = value as DueKind;
        switch (dueKind) {
            case DueKindEnum.NONE:
                updateTask({...selectedTask, dueKind, dueDate: null, dueTime: null}, true);
                return;
            case DueKindEnum.DATED:
                updateTask({...selectedTask, dueKind, dueDate: new DueDate(), dueTime: null}, true);
                return;
            case DueKindEnum.DATETIME:
                updateTask({...selectedTask, dueKind, dueDate: new DueDate(), dueTime: new DueTime()}, true);
                return;
        }
    };

    const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedTask) return;
        updateTask({...selectedTask, dueDate: new DueDate(event.target.value)}, true);
    };

    const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedTask) return;
        updateTask({...selectedTask, dueTime: new DueTime(event.target.value)}, true);
    };

    return (
        <div className={TASK_DETAIL_DISPLAY_DUE_CLASS_NAMES} >
            <label>期日</label>
            <PullDown
                items={Object.values(DueKindEnum).map(convertDueKindToDisplayText)}
                values={Object.values(DueKindEnum)}
                onChange={handleSelect}
                defaultValue={selectedTask && selectedTask.dueKind}
            />
            <input
                type="date"
                defaultValue={selectedTask && selectedTask.dueDate ? selectedTask.dueDate.toString() : undefined}
                className={classNames(
                    [DueKindEnum.DATED, DueKindEnum.DATETIME].includes(String(selectedTask?.dueKind)) || "d-none",
                    "m-1",
                )}
                onChange={handleDateChange}
            />
            <input
                type="time"
                defaultValue={selectedTask && selectedTask.dueTime ? selectedTask.dueTime.toString() : undefined}
                className={classNames(
                    selectedTask?.dueKind === DueKindEnum.DATETIME || "d-none",
                    "m-1",
                )}
                onChange={handleTimeChange}
            />
        </div>
    )
};

export default Due;