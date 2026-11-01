import type { ToDoTask } from "@/feature/todolist/types/todotask";
import { toInsertApiFormat } from "./mapper";
import { customizedFetch } from "@/hooks/fetch";


/**
 * タスクを新規登録するAPI。  
 * @param newTask 新規登録するタスク
 * @returns サーバーで発行されたID
 */
export const resiterTask = async (newTask: ToDoTask) => {
    const id = await customizedFetch<number>({
        url: "/todolist/register",
        method: "POST",
        data: toInsertApiFormat(newTask),
    });
    return id;
}