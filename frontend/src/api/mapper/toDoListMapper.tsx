import { DueDate, DueTime } from "@/feature/todolist/entity/due-entities";
import type { GetAllApi } from "@/types/todolist/api";
import type { ToDoTask } from "@/types/todolist/todotask";
import { fromDateString } from "@/utils/date";


const toToDoTask = (apiObj: GetAllApi): ToDoTask => {
    return {
        id: apiObj.id,
        title: apiObj.title,
        dueKind: apiObj.dueKind,
        dueDate: apiObj.dueDate ? new DueDate(fromDateString(apiObj.dueDate)) : null,
        dueTime: apiObj.dueTime ? new DueTime(apiObj.dueTime) : null,
        priority: apiObj.priority,
        isCompleted: apiObj.isCompleted,
        memo: apiObj.memo || undefined,
    }
};

export default toToDoTask;