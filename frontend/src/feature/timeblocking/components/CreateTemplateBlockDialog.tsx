import CHButton from "@/components/CHButton";
import { isValidUiBlockWidth } from "../utils/blockValidation";
import { useCallback, useContext, useRef, useState, type FC } from "react"

import BlockRepositories from "../contexts/BlockRepositories"
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import type { TemplateBlockInput } from "../types/blockSourceTypes";
import { register } from "../api/templateBlockApi";
import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import BlockWidthField from "@/components/BlockWidthField";


type CreateTemplateBlockDialogProps = {
    open: boolean,
    setOpen: (open: boolean) => void,
}

/** テンプレートブロックの入力と非同期の作成操作を表示する。 */
const CreateTemplateBlockDialog: FC<CreateTemplateBlockDialogProps> = ({ open, setOpen }) => {
    const {
        setTemplateBlocks,
    } = useContext(BlockRepositories);

    const {
        slotMinutes,
    } = useContext(TimeTableConfigure);

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

    const buildBlock = useCallback((): TemplateBlockInput => {
        return {
            title,
            width,
            color,
        }
    }, [title, width, color]);

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
            setTemplateBlocks(blocks => [...blocks, { ...block, id }]);
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
                <DialogTitle>テンプレートブロックを作成</DialogTitle>
                <DialogContent aria-busy={saving}>
                    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
                    <Stack spacing={3} sx={{padding: 1}}>
                        {saveError && <Alert severity="error">テンプレートブロックを作成できませんでした。</Alert>}
                        <TextField
                            disabled={saving}
                            label="タイトル"
                            value={title}
                            onChange={handleTitleChange}
                            error={titleHasError}
                            helperText={titleHasError ? "タイトルを入力してください" : ""}
                        />
                        <BlockWidthField
                            value={width}
                            onChange={handleWidthChange}
                            error={widthHasError}
                            helperText={widthHasError ? "幅は1〜1440分でスロットの倍数にしてください" : ""}
                            label={"幅"}
                        />
                        <TextField
                            disabled={saving}
                            label="色"
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

export default CreateTemplateBlockDialog;