import { isValidBlockWidth } from "../utils/blockValidation";
import { Box, Alert, Modal, Stack, type SxProps } from "@mui/material";
import { useCallback, useContext, useEffect, useState } from "react";

import type { TemplateBlockSource } from "../types/blockSourceTypes";
import BlockRepositories from "../contexts/BlockRepositories";
import SelectedTemplateBlockId from "../contexts/SelectedTemplateBlockId";
import Title from "./timeBlockDetailPanelComponents/Title";
import Width from "./timeBlockDetailPanelComponents/Width";
import DeleteButton from "./timeBlockDetailPanelComponents/DeleteButton";
import { deleteApi, update } from "../api/templateBlockApi";


const style: SxProps = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
}

/**
 * テンプレートブロックの詳細を表示するモーダル
 */
const TemplateBlockDetailPanel = () => {

    const [validationError, setValidationError] = useState<string | null>(null);
    const [ templateBlock, setTemplateBlock ] = useState<TemplateBlockSource | null>(null);

    const {
        templateBlocks,
        setTemplateBlocks,
    } = useContext(BlockRepositories);

    const reflectChangedBlockIntoRepository = useCallback((block: TemplateBlockSource) => {
        setTemplateBlocks((blocks) => blocks.map(b => b.id === block.id ? block : b));
    }, [setTemplateBlocks]);

    const {
        selectedTemplateBlockId,
        setSelectedTemplateBlockId,
    } = useContext(SelectedTemplateBlockId)

    // モーダルの表示状態を管理するステート
    const [ open, setOpen ] = useState(false);

    /**
     * `selectedTimeBlockId` を監視し, 選択ブロックやモーダルの開閉状態を更新する
     */
    useEffect(() => {
        setValidationError(null);
        setOpen(selectedTemplateBlockId !== null);
        if (selectedTemplateBlockId === null) return;
        setTemplateBlock(templateBlocks.find(b => b.id === selectedTemplateBlockId) || null);
    }, [selectedTemplateBlockId]);

    const handleClose = useCallback(() => {
        setSelectedTemplateBlockId(null);
    }, [setSelectedTemplateBlockId]);

    const handleSetText = useCallback((text: string) => {
        const editedBlock = templateBlock && { ...templateBlock, text };
        if (editedBlock === null) return;
        if (!isValidBlockWidth(editedBlock.width)) {
            setValidationError("幅は1〜1440分の整数で入力してください。");
            return;
        }
        setValidationError(null);
        setTemplateBlock(editedBlock);
        reflectChangedBlockIntoRepository(editedBlock);
        update(editedBlock);
    }, [templateBlock]);

    const handleSetWidth = useCallback((width: number) => {
        const editedBlock = templateBlock && { ...templateBlock, width };
        if (editedBlock === null) return;
        if (!isValidBlockWidth(editedBlock.width)) {
            setValidationError("幅は1〜1440分の整数で入力してください。");
            return;
        }
        setValidationError(null);
        setTemplateBlock(editedBlock);
        reflectChangedBlockIntoRepository(editedBlock);
        update(editedBlock);
    }, [templateBlock]);

    const handleDelete = useCallback(() => {
        if (templateBlock === null) return;
        if (!templateBlock.id) throw new Error("id is not still set: waiting for server response.");
        setTemplateBlocks((blocks) => blocks.filter(b => b.id !== templateBlock.id));
        setSelectedTemplateBlockId(null);
        deleteApi(templateBlock.id);
    }, [templateBlock, setTemplateBlocks, setSelectedTemplateBlockId]);

    return (
        <Modal
            open={open}
            onClose={handleClose}
        >
            <Box
                sx={style}
            >
                <Stack spacing={3}>
                    {(validationError || (templateBlock && !isValidBlockWidth(templateBlock.width))) && <Alert severity="error">{validationError || "幅は1〜1440分の整数で入力してください。"}</Alert>}
                    <Title text={templateBlock?.title} setText={handleSetText} />
                    <Width width={templateBlock?.width || 0} setWidth={handleSetWidth} />
                    <DeleteButton onDelete={handleDelete} />
                </Stack>
            </Box>
        </Modal>
    )
};

export default TemplateBlockDetailPanel;