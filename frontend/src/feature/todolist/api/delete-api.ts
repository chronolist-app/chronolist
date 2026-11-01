import { customizedFetch } from "@/hooks/fetch";


/**
 * タスクを一つ削除するAPI  
 * @param id 削除するタスク
 */
export const deleteTask = async (id: number) => {
    await customizedFetch<void>({
        url: "/todolist/delete",
        method: "DELETE",
        data: { id },
    });
};


/**
 * 複数のタスクを削除するAPI  
 * @param ids 削除するタスク
 */
export const deleteTasks = async (ids: number[]) => {
    await customizedFetch<void>({
        url: "/todolist/delete",
        method: "DELETE",
        data: { ids },
    });
};