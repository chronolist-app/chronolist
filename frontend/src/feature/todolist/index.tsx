import { useEffect, useState } from "react";

import type { ToDoTask } from "@/feature/todolist/types/todotask";
import { SelectedToDoTaskContext } from "./components/selected-todotask-context";
import AllToDoTasksContext from "./components/all-todotasks-context";
import ToDoTable from "./components/todotable";
import TaskDetailDisplay from "./components/task-detail-display";
import useFetch from "@/utils/fetch";
import type { GetAllApi } from "@/types/todolist/api";
import toToDoTask from "@/api/mapper/toDoListMapper";
import { updateTask as updateTaskApi } from "./api/update-api";
import classNames from "classnames";
import Buttons from "./components/buttons";
import RegisterModal from "./components/modals/register-modal";
import DeleteModal from "./components/modals/delete-modal";

import "@/feature/todolist/assets/todolist-page.css";


const TODOLIST_PAGE_ID = "todolist-page";

const ToDoListPage = () => {

    
    const [allTasks, setAllTasks] = useState<ToDoTask[]>([]);
    const updateTask = (updatedTask: ToDoTask, callApi?: boolean) => {
        setAllTasks(allTasks.map(task => task.id === updatedTask.id ? updatedTask : task));
        if (callApi) updateTaskApi(updatedTask);
    };
    
    const { data, isLoading, error } = useFetch<GetAllApi[]>(
        "todolist/getAll",
        "GET",
    );

    useEffect(() => {
        if (error) throw error;
        if (data) setAllTasks(data.map(toToDoTask));
    }, [ isLoading ])

    const [ selectedTaskId, setSelectedTaskId ] = useState<number | null>(null);

    const [ showRegisterModal, setShowRegisterModal ] = useState(false);
    const [ showDeleteModal, setShowDeleteModal ] = useState(false);

    return (
        <SelectedToDoTaskContext value={{ id: selectedTaskId, set: setSelectedTaskId }}>
            <AllToDoTasksContext value={{ tasks: allTasks, setTasks: setAllTasks, updateTask}}>
                <div id={TODOLIST_PAGE_ID} className={classNames("flex-fill", "d-flex", "p-2", "align-items-stretch")}>
                    <div className={classNames("flex-fill", "d-flex", "flex-column", "p-2", "border", "border-dark",)}>
                        <Buttons onRegisterButtonClicked={() => {setShowRegisterModal(true);}} onDeleteButtonClicked={() => {setShowDeleteModal(true)}}/>
                        <ToDoTable />
                    </div>
                    <TaskDetailDisplay />
                </div>
                <RegisterModal show={showRegisterModal} setShow={setShowRegisterModal} />
                <DeleteModal show={showDeleteModal} setShow={setShowDeleteModal} />
            </AllToDoTasksContext>
        </SelectedToDoTaskContext>
    )
}

export default ToDoListPage;