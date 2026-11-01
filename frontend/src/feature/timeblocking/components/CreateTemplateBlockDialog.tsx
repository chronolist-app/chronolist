import { useCallback, useContext, useState, type FC } from "react"

import { v4 as uuidv4 } from "uuid";
import BlockRepositories from "../contexts/BlockRepositories"
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import type { TemplateBlockSource } from "../types/blockSourceTypes";
import { register } from "../api/templateBlockApi";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import BlockWidthField from "@/components/BlockWidthField";


type CreateTemplateBlockDialogProps = {
    open: boolean,
    setOpen: (open: boolean) => void,
}

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
    };

    const buildBlock = useCallback((): TemplateBlockSource => {
        return {
            clientId: uuidv4(),
            title,
            width,
            color,
        }
    }, [title, width, color]);

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
        setTemplateBlocks((blocks) => [...blocks, block]);
        handleClose();

        block.id = await register(block);
    };

    return (
        <>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>テンプレートブロックを作成</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{padding: 1}}>
                        <TextField
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
                            helperText={widthHasError ? "幅を入力してください" : ""}
                            label={"幅"}
                        />
                        <TextField
                            label="色"
                            value={color}
                            onChange={handleColorChange}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>キャンセル</Button>
                    <Button onClick={handleClick}>作成</Button>
                </DialogActions>
            </Dialog>
        </>
    )
};

export default CreateTemplateBlockDialog;