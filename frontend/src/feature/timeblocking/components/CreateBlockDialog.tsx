import { useContext, useState, type FC } from "react";
import { v4 as uuidv4 } from "uuid";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import type { TimeBlockSource } from "../types/blockSourceTypes";
import BlockRepositories from "../contexts/BlockRepositories";
import BlockWidthField from "@/components/BlockWidthField";
import register from "../api/timeBlock/register";


type CreateBlockDialogProps = {
    open: boolean,
    setOpen: (open: boolean) => void,
};

const CreateBlockDialog: FC<CreateBlockDialogProps> = ({ open, setOpen }) => {

    const {
        slotMinutes,
    } = useContext(TimeTableConfigure);

    const {
        setBlocksAtField,
    } = useContext(BlockRepositories);
    
    const [ title, setTitle ] = useState<string>("");
    const [ titleHasError, setTitleHasError ] = useState<boolean>(false);
    const [ width, setWidth ] = useState<number>(slotMinutes);
    const [ widthHasError, setWidthHasError ] = useState<boolean>(false);
    const [ color, setColor ] = useState<string>("gray");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value.trim());
        setTitleHasError(false);
    };
    const handleWidthChange = (width: number) => {
        setWidth(width);
        setWidthHasError(false);
    };
    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setColor(e.target.value.trim());
    };

    const handleClose = () => {
        setOpen(false);
        setTitle("");
        setWidth(slotMinutes);
        setColor("gray");
        setSaveError(false);
    };

    const buildBlock = () => {
        if (!title) throw new Error("title is undefined.");
        const block: TimeBlockSource = {
            clientId: uuidv4(),
            timeTableId: null,
            title,
            width,
            color,
            status: "HOLD",
            startAt: null,
            tasks: [],
        };
        return block;
    };

    const handleClick = async () => {
        if (!title) {
            setTitleHasError(true);
            return;
        }
        if (!width) {
            setWidthHasError(true);
            return;
        }
        const block = buildBlock();
        setSaving(true);
        setSaveError(false);
        try {
            const id = await register(block);
            setBlocksAtField((blocks) => [...blocks, { ...block, id }]);
            handleClose();
        } catch {
            setSaveError(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={saving ? undefined : handleClose}>
                <DialogTitle>ブロックを作成</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{padding: 1}}>
                        {saveError && <Alert severity="error">ブロックを作成できませんでした。</Alert>}
                        <TextField
                            label="ブロック名"
                            value={title}
                            onChange={handleTitleChange}
                            error={titleHasError}
                            helperText={titleHasError ? "ブロック名を入力してください" : undefined}
                        />
                        <BlockWidthField
                            value={width}
                            onChange={handleWidthChange}
                            error={widthHasError}
                            helperText={widthHasError ? "幅を入力してください" : undefined}
                            label={"幅"}
                        />
                        <TextField
                            label="カラー"
                            value={color}
                            onChange={handleColorChange}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={saving}>キャンセル</Button>
                    <Button onClick={handleClick} disabled={saving}>作成</Button>
                </DialogActions>
            </Dialog>
        </>
    )
};

export default CreateBlockDialog;
