import { useLayoutEffect, useMemo, useRef, useState, type FC } from "react";
import { Alert, Box, Checkbox, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { v4 as uuidv4 } from "uuid";
import type { TimeBlockTask } from "../../types/blockSourceTypes";
import EditableText from "@/components/EditableText";
import { deleteApi, register, update } from "../../api/timeBlockTaskApi";
import { createTaskOperations, type TaskUpdate } from "../../utils/taskOperations";

type TasksProps = {
    tasks: TimeBlockTask[];
    blockId: number;
    setTasks: (blockId: number, change: TaskUpdate) => void;
};

/** 専用APIの保存結果を反映するタスク一覧。 */
const TimeBlockTasks: FC<TasksProps> = ({ tasks, blockId, setTasks }) => {
    const currentTasks = useRef(tasks);
    currentTasks.current = tasks;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const operations = useMemo(() => createTaskOperations({
        api: { register, update, deleteApi },
        getTasks: () => currentTasks.current,
        commit: change => {
            currentTasks.current = change(currentTasks.current);
            setTasks(blockId, change);
        },
        notify: (pending, message) => {
            setBusy(pending);
            setError(message);
            // EditableTextの未保存ドラフトは、この一覧だけで保存値へ戻す。
            if (!pending) setRevision(value => value + 1);
        },
    }), [blockId, setTasks]);

    useLayoutEffect(() => {
        operations.setActive(true);
        return () => operations.setActive(false);
    }, [operations]);

    return (
        <Stack>
            <Divider orientation="horizontal" textAlign="left" flexItem>タスク</Divider>
            {error && <Alert severity="error">{error}</Alert>}
            <List aria-busy={busy}>
                {tasks.map(task => (
                    <ListItem key={task.clientId}>
                        <Checkbox
                            checked={false}
                            disabled={busy}
                            inputProps={{ "aria-label": task.title + "を削除" }}
                            onChange={() => { void operations.run({ kind: "delete", task }); }}
                        />
                        <Box sx={{ pointerEvents: busy ? "none" : "auto", opacity: busy ? 0.6 : 1 }}>
                            <EditableText
                                key={task.clientId + "-" + revision}
                                value={task.title}
                                onChange={title => { void operations.run({ kind: "update", task, title }); }}
                            />
                        </Box>
                    </ListItem>
                ))}
                <ListItemButton disabled={busy} onClick={() => {
                    const task = { clientId: uuidv4(), timeBlockId: blockId, title: "new Task" };
                    void operations.run({ kind: "add", task });
                }}>
                    <ListItemIcon><AddIcon /></ListItemIcon>
                    <ListItemText>タスクを追加</ListItemText>
                </ListItemButton>
            </List>
        </Stack>
    );
};
export default TimeBlockTasks;
