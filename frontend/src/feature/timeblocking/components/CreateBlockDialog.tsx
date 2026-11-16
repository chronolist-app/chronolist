import { isValidUiBlockWidth } from "../utils/blockValidation";
import { useContext, useRef, useState, type FC } from "react";
import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import type { TimeBlockInput } from "../types/blockSourceTypes";
import BlockRepositories from "../contexts/BlockRepositories";
import BlockWidthField from "@/components/BlockWidthField";
import register from "../api/timeBlock/register";
import CHButton from "@/components/CHButton";


type CreateBlockDialogProps = {
    open: boolean,
    setOpen: (open: boolean) => void,
};

/** タイムブロックの入力と非同期の作成操作を表示する。 */
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
        const block: TimeBlockInput = {
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

    const savingRef = useRef(false);

    const handleClick = async () => {
        if (savingRef.current) return;
        if (!title) {
            setTitleHasError(true);
            return;
        }
        if (!isValidUiBlockWidth(width, slotMinutes)) {
            setWidthHasError(true);
            return;
        }
        const block = buildBlock();
        savingRef.current = true;
        setSaving(true);
        setSaveError(false);
        try {
            const id = await register(block);
            setBlocksAtField((blocks) => [...blocks, { ...block, id }]);
            handleClose();
        } catch {
            setSaveError(true);
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={saving ? undefined : handleClose}>
                <DialogTitle>ブロックを作成</DialogTitle>
                <DialogContent aria-busy={saving}>
                    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
                    <Stack spacing={3} sx={{padding: 1}}>
                        {saveError && <Alert severity="error">ブロックを作成できませんでした。</Alert>}
                        <TextField
                            disabled={saving}
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
                            helperText={widthHasError ? "幅は1〜1440分でスロットの倍数にしてください" : undefined}
                            label={"幅"}
                        />
                        <TextField
                            disabled={saving}
                            label="カラー"
                            value={color}
                            onChange={handleColorChange}
                        />
                    </Stack>
                    </fieldset>
                </DialogContent>
                <DialogActions>
                    <CHButton variant="secondary" appearance="text" onClick={handleClose} disabled={saving} label="キャンセル" />
                    <CHButton onClick={handleClick} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : undefined} label={saving ? "作成中…" : "作成"} />
                </DialogActions>
            </Dialog>
        </>
    )
};

export default CreateBlockDialog;
