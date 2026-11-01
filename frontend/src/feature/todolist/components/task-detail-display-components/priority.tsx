import { useContext } from "react"
import classNames from "classnames";

import { SelectedToDoTaskContext } from "../selected-todotask-context"
import PullDown from "@/components/pulldown";
import { PriorityEnum, type Priority as Priority_ } from "@/feature/todolist/types/statics";
import { convertPriorityToDisplayText } from "../../utils/to-display-text";
import AllToDoTasksContext from "../all-todotasks-context";

// 優先度要素の固有クラス名
const TASK_DETAIL_DISPLAY_PRIORITY_CLASS_NAME_TAG = "task-detail-display-priority";
// 優先度要素が持つクラス群
const TASK_DETAIL_DISPLAY_PRIORITY_CLASS_NAMES = classNames(
    TASK_DETAIL_DISPLAY_PRIORITY_CLASS_NAME_TAG,
    "mx-1", 
    "d-flex",
);

const Priority = () => {
    const { id } = useContext(SelectedToDoTaskContext);
    const { tasks, updateTask } = useContext(AllToDoTasksContext);
    const selectedTask = tasks.find(task => task.id === id);

    const handleSelect = (value: string) => {
        if (!selectedTask) return;
        updateTask({...selectedTask, priority: value as Priority_}, true);
    };

    return (
        <div className={TASK_DETAIL_DISPLAY_PRIORITY_CLASS_NAMES}>
            <label htmlFor="priority">優先度</label>
            <PullDown
                items={Object.values(PriorityEnum).map(priority => convertPriorityToDisplayText(priority))}
                values={Object.values(PriorityEnum)}
                onChange={handleSelect}
                defaultValue={selectedTask && selectedTask.priority}
            />
        </div>
    )
}

export default Priority;