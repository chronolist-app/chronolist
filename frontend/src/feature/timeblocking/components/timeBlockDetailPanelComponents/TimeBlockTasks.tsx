import { useCallback, type FC } from "react";
import { Checkbox, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { v4 as uuidv4 } from "uuid";

import type { TimeBlockTask } from "../../types/blockSourceTypes";
import EditableText from "@/components/EditableText";
import { deleteApi, register, update } from "../../api/timeBlockTaskApi";


type TasksProps = {
    tasks: TimeBlockTask[],
    blockId: number,
    setTasks: (tasks: TimeBlockTask[]) => void
};

/**
 * タイムブロックのタスクを表示するコンポーネント
 */
const TimeBlockTasks: FC<TasksProps> = ({ tasks, blockId, setTasks }) => {

    const handleAddTask = useCallback( async () => {
        const newTask: TimeBlockTask = { clientId: uuidv4(), timeBlockId: blockId, title: "new Task" };
        setTasks([...tasks, newTask]);
        const id = await register(newTask);
        newTask.id = id;
    }, [tasks, setTasks]);

    const handleChange = useCallback((task: TimeBlockTask, newTitle: string) => {
        const newTask: TimeBlockTask = {...task, title: newTitle};
        setTasks(tasks.map(t => t.clientId === task.clientId ? newTask : t));
        update(newTask);
    }, [setTasks]);

    const handleCheck = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const taskClientId = e.target.id;
        const targetTask = tasks.find(task => task.clientId === taskClientId);
        if (!targetTask) throw new Error("タスクを取得できません。");
        if (!targetTask.id) throw new Error("タスクIDを取得できません。");
        setTasks(tasks.filter(task => task.clientId !== taskClientId));
        await deleteApi(targetTask.id);
    }, [setTasks, tasks]);
    
    return (
        <>
            <Stack>
                <Divider orientation={"horizontal"} textAlign="left" flexItem>タスク</Divider>
                <List>
                    {tasks.map((task) => (
                        <ListItem key={`block-task-${task.clientId}`}>
                            <Checkbox onChange={handleCheck} id={task.clientId} />
                            <EditableText value={task.title} onChange={(value) => { handleChange(task, value)}} />
                        </ListItem>
                    ))}

                    {/* 新規タスクを追加するボタン */}
                    <ListItemButton onClick={handleAddTask}>
                        <ListItemIcon>
                            <AddIcon />
                        </ListItemIcon>
                        <ListItemText>タスクを追加</ListItemText>
                    </ListItemButton>
                </List>
            </Stack>
        </>
    )
};

export default TimeBlockTasks;