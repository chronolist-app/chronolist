import { useContext, type FC } from "react";

import AllToDoTasksContext from "../all-todotasks-context";
import { deleteTasks } from "../../api/delete-api";
import { ChronolistModal } from "@/components/modal";


/**
 * 完了済みタスクの削除の確認を行い、削除を実行するモーダル
 */
const DeleteModal: FC<{show: boolean, setShow: (show: boolean) => void}> = ({show, setShow}) => {
    
    const { tasks, setTasks } = useContext(AllToDoTasksContext);

    const handleDelete = () => {
        const completedTasks = tasks.filter(task => task.isCompleted);
        setTasks(tasks.filter(task => !task.isCompleted));
        deleteTasks(completedTasks.map(task => task.id));
        setShow(false);
    };

    return (
        <ChronolistModal
            title="完了済みタスクを削除"
            isOpen={show}
            acceptButtonlabel="削除"
            onAccept={handleDelete}
            cancelButtonlabel="キャンセル"
            onCancel={() => setShow(false)}
            onClose={() => setShow(false)}
        >
            <p>本当に完了済みタスクを全て削除しますか？</p>
        </ChronolistModal> 
    )
};

export default DeleteModal;