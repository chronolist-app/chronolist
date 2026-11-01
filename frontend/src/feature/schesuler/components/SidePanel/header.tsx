import type { FC } from "react"
import { Button, Stack } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

import EditableText from "@/components/EditableText";

type SidePanelHeaderProps = {
    title: string,
    setTitle: (title: string) => void,
    onDelete: () => void,
}

const DeleteButton = ({ onDelete }: { onDelete: () => void }) => {
    return (
        <Button onClick={onDelete} color="error" startIcon={<DeleteIcon />}>削除</Button>
    )
}

const Header: FC<SidePanelHeaderProps> = ({ title, setTitle, onDelete }) => {
    return (
        <>
            <Stack
                direction={"column"}
                spacing={1}
                sx={{alignItems: "stretch"}}
            >
                <Stack direction={"row"} sx={{justifyContent: "flex-end"}}>
                    <DeleteButton onDelete={onDelete} />
                </Stack>
                <EditableText value={title} onChange={setTitle} variant="h2" sx={{textAlign: "center"}}/>
            </Stack>
        </>
    )
}

export default Header;