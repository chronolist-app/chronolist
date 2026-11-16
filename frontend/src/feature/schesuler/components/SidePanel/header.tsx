import CHButton from "@/components/CHButton";
import type { FC } from "react"
import { Stack } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

import EditableText from "@/components/EditableText";

type SidePanelHeaderProps = {
    title: string,
    setTitle: (title: string) => void,
    onDelete: () => void,
}

const DeleteButton = ({ onDelete }: { onDelete: () => void }) => {
    return (
        <CHButton onClick={onDelete} variant="danger" appearance="text" startIcon={<DeleteIcon />} label="削除" />
    )
}

/** 予定のタイトル編集と削除操作を表示する。 */
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