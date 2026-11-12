import { reflectBlockTasks, type TaskUpdate } from "../utils/taskOperations";
import { getBlockValidationError, isValidBlockWidth } from "../utils/blockValidation";
import { Alert, Button, Modal, Stack, Box, type SxProps } from "@mui/material"
import Title from "./timeBlockDetailPanelComponents/Title"
import { useCallback, useContext, useEffect, useState, type FC } from "react";
import SelectedTimeBlockClientId from "../contexts/SelectedTimeBlockClientId";
import BlockRepositories from "../contexts/BlockRepositories";
import type { TimeBlockSource } from "../types/blockSourceTypes";
import { Time } from "@/utils/time";
import TimeRange from "./timeBlockDetailPanelComponents/TimeRange";
import Width from "./timeBlockDetailPanelComponents/Width";
import TimeBlockTasks from "./timeBlockDetailPanelComponents/TimeBlockTasks";
import DeleteButton from "./timeBlockDetailPanelComponents/DeleteButton";
import { update, updateStartAt, deleteApi } from "../api/timeBlockApi";

import TimeTableConfigure from "../contexts/TimeTableConfigure";

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
 * タイムブロックの詳細を表示するモーダル
 */
const TimeBlockDetailPanel: FC = () => {

    const [validationError, setValidationError] = useState<string | null>(null);

    const { slotMinutes } = useContext(TimeTableConfigure);

    // 選択中のブロック
    const [ block, setBlock ] = useState<TimeBlockSource | undefined>(undefined);

    const {
        blocksOnTable,
        setBlocksOnTable,
        blocksAtField,
        setBlocksAtField,
    } = useContext(BlockRepositories);

    /**
     * パネル中でのブロックの変更をブロックリポジトリに反映する関数
     */
    const reflectBlockToRepository = useCallback((block: TimeBlockSource) => {
        switch (block.status) {
            case "PLACED":
                setBlocksOnTable((blocks) => blocks.map(b => b.clientId === block.clientId ? block : b));
                break;
            case "HOLD":
                setBlocksAtField((blocks) => blocks.map(b => b.clientId === block.clientId ? block : b));
                break;
        }
    }, [setBlocksOnTable, setBlocksAtField]);

    const {
        selectedTimeBlockId,
        setSelectedTimeBlockClientId,
    } = useContext(SelectedTimeBlockClientId);

    // モーダルの表示状態を管理するステート
    const [ open, setOpen ] = useState(false);

    /**
     * `selectedTimeBlockId` を監視し, 選択ブロックステートやモーダルの開閉状態を更新する
     */
    useEffect(() => {
        setValidationError(null);
        setOpen(selectedTimeBlockId !== null);
        if (selectedTimeBlockId === null) return;
        const selectedBlock = blocksOnTable.find(b => b.clientId === selectedTimeBlockId) || blocksAtField.find(b => b.clientId === selectedTimeBlockId);
        setBlock(selectedBlock);
    }, [selectedTimeBlockId, blocksOnTable, blocksAtField]);

    /**
     * モーダルが閉じられた際の処理
     */
    const handleClose = useCallback(() => {
        setSelectedTimeBlockClientId(null);
    }, [setSelectedTimeBlockClientId]);

    /** 幅と開始の両方が不正な既存データを、明示操作で同時に修復する。 */
    const handleRepair = async () => {
        if (!block) return;
        const repaired = { ...block, startAt: new Time(0), width: slotMinutes };
        try {
            await update(repaired);
            setValidationError(null);
            setBlock(repaired);
            reflectBlockToRepository(repaired);
        } catch {
            setValidationError("ブロックを修正できませんでした。");
        }
    };

    /**
     * タイトルを変更した際の処理
     */
    const handleSetText = useCallback((text: string) => {
        const editedBlock = block && { ...block, title: text };
        if (editedBlock) {
            const error = getBlockValidationError(editedBlock);
            setValidationError(error);
            if (error) return;
        }
        setBlock(editedBlock);
        if (editedBlock) {
            reflectBlockToRepository(editedBlock);
            update(editedBlock);
        }
    }, [block, setBlock, reflectBlockToRepository]);

    /**
     * ブロックの開始時刻(及び終了時刻)を変更した際の処理
     */
    const handleSetTime = useCallback((time: Time) => {
        const editedBlock = block && { ...block, startAt: time };
        if (editedBlock) {
            const error = getBlockValidationError(editedBlock);
            setValidationError(error);
            if (error) return;
        }
        setBlock(editedBlock);
        if (!editedBlock) return;
        if (!editedBlock.id) throw new Error("id is not still set: waiting for server response.");
        if (editedBlock) {
            reflectBlockToRepository(editedBlock);
            updateStartAt(editedBlock.id, editedBlock.startAt);
        }
    }, [block, setBlock, reflectBlockToRepository]);

    /**
     * ブロックの幅を変更した際の処理
     */
    const handleSetWidth = useCallback((width: number) => {
        const editedBlock = block && { ...block, width: width };
        if (editedBlock) {
            const error = getBlockValidationError(editedBlock);
            setValidationError(error);
            if (error) return;
        }
        setBlock(editedBlock);
        if (editedBlock) {
            reflectBlockToRepository(editedBlock);
            update(editedBlock);
        }
    }, [block, setBlock, reflectBlockToRepository]);

    /**
     * ブロックのタスクを変更した際の処理
     */
    const handleSetTasks = useCallback((blockId: number, change: TaskUpdate) => {
        setBlock(current => current?.id === blockId ? { ...current, tasks: change(current.tasks) } : current);
        setBlocksOnTable(blocks => reflectBlockTasks(blocks, blockId, change));
        setBlocksAtField(blocks => reflectBlockTasks(blocks, blockId, change));
    }, [setBlocksOnTable, setBlocksAtField]);

    /**
     * 削除ボタンを押した際の処理
     */
    const handleDelete = useCallback(() => {
        if (!block) return;
        if (!block.id) throw new Error("id is not still set: waiting for server response.");

        switch (block.status) {
            case "PLACED":
                setBlocksOnTable((blocks) => blocks.filter(b => b.clientId !== block.clientId));
                break;
            case "HOLD":
                setBlocksAtField((blocks) => blocks.filter(b => b.clientId !== block.clientId));
                break;
        }
        setSelectedTimeBlockClientId(null);
        deleteApi(block.id);
    }, [block, setBlocksOnTable, setBlocksAtField, setSelectedTimeBlockClientId]);


    return (
        <Modal
            open={open}
            onClose={handleClose} 
        >
            <Box
                sx={style}>
                <Stack spacing={3}>
                    {(validationError || (block && getBlockValidationError(block))) && <Alert severity="error">{validationError || (block && getBlockValidationError(block))}</Alert>}
                    {block?.status === "PLACED" && !isValidBlockWidth(block.width) &&
                        (!block.startAt || block.startAt.toMinutes() < 0 ||
                            block.startAt.toMinutes() >= 1440 || block.startAt.toMinutes() + slotMinutes > 1440) && (
                        <Button onClick={handleRepair}>00:00・{slotMinutes}分に修正</Button>
                    )}
                    <Title text={block?.title} setText={handleSetText} />
                    {block?.startAt && <TimeRange width={block?.width} startAt={block?.startAt || undefined} setStartAt={handleSetTime} />}
                    <Width width={block?.width || 0} setWidth={handleSetWidth} />
                    {block && block.id && <TimeBlockTasks key={block.id} tasks={block.tasks} blockId={block.id} setTasks={handleSetTasks} />}
                    <DeleteButton onDelete={handleDelete} />
                </Stack>
            </Box>
        </Modal>
    )
};

export default TimeBlockDetailPanel;
