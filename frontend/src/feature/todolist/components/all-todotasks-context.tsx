import { createContext } from "react";

import type { ToDoTask } from "@/feature/todolist/types/todotask";

const AllToDoTasksContext = createContext<{
    tasks: ToDoTask[],
    setTasks: (tasks: ToDoTask[]) => void,
    updateTask: (updatedTask: ToDoTask, callApi?: boolean) => void
}>({
    tasks: [],
    setTasks: () => {},
    updateTask: () => {},
});

export default AllToDoTasksContext;