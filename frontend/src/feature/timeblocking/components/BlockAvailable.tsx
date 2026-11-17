import { DragOverlay, useDndMonitor, type DragEndEvent } from "@dnd-kit/core";
import { Backdrop, CircularProgress } from "@mui/material";
import { useSnackbar } from "notistack";
import { useContext, useLayoutEffect, useRef, useState, type FC, type ReactElement } from "react";
import { useLocation } from "react-router-dom";

import type { TemplateBlockSource, TimeBlockSource, DraggableBlock, TimeBlockInput } from "../types/blockSourceTypes";
import { Time } from "@/utils/time";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import BlockRepositories from "../contexts/BlockRepositories";
import TimeBlockView from "./TimeBlockView";
import { BLOCKS_AREA_ID, TEMPLATE_BLOCKS_AREA_ID, TIMETABLE_ID } from "../static/droppableId";
import { register as registerTemplateBlock } from "../api/templateBlockApi";
import { register as registerTimeBlock, update as updateTimeBlock } from "../api/timeBlockApi";
import { getDropStartMinutes } from "../utils/dropTime";

type BlockAvailableProps = {
    children?: ReactElement[],
};

const BlockAvailable: FC<BlockAvailableProps> = ({ children }) => {
    const [blocksOnTable, setBlocksOnTable] = useState<TimeBlockSource[]>([]);
    const [blocksAtField, setBlocksAtField] = useState<TimeBlockSource[]>([]);
    const [templateBlocks, setTemplateBlocks] = useState<TemplateBlockSource[]>([]);
    const [draggingBlock, setDraggingBlock] = useState<DraggableBlock | null>(null);
    const [previewBlock, setPreviewBlock] = useState<DraggableBlock | null>(null);
    const [tableRevision, setTableRevision] = useState(0);
    const { enqueueSnackbar } = useSnackbar();

    const drag = useRef<{ block: DraggableBlock, locationKey: string } | null>(null);
    const saving = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const setSaving = (pending: boolean) => {
        saving.current = pending;
        setIsSaving(pending);
    };
    const { timeTableId, slotHeight, slotMinutes } = useContext(TimeTableConfigure);
    const { key: locationKey } = useLocation();
    const activeTable = useRef({ timeTableId, locationKey });

    useLayoutEffect(() => {
        activeTable.current = { timeTableId, locationKey };
    }, [timeTableId, locationKey]);

    const getDropTime = ({ active, over }: Pick<DragEndEvent, "active" | "over">, source: DraggableBlock) => {
        const translated = active.rect.current.translated;
        if (over?.id !== TIMETABLE_ID || timeTableId <= 0 || !translated) return null;
        const startMinutes = getDropStartMinutes(
            translated.top - over.rect.top, slotHeight, slotMinutes, source, timeTableId,
        );
        return startMinutes === null ? null : new Time(startMinutes);
    };

    const showPreview = (event: Pick<DragEndEvent, "active" | "over">) => {
        const currentDrag = drag.current;
        const startAt = currentDrag && getDropTime(event, currentDrag.block);
        if (!currentDrag || currentDrag.locationKey !== locationKey || !startAt) {
            setPreviewBlock(null);
            return;
        }
        setPreviewBlock(previous => {
            if (previous?.timeTableId === timeTableId &&
                previous.startAt?.toMinutes() === startAt.toMinutes()) return previous;
            return { ...currentDrag.block, status: "PLACED", timeTableId, startAt };
        });
    };

    const clearDrag = () => {
        drag.current = null;
        setDraggingBlock(null);
        setPreviewBlock(null);
    };

    useDndMonitor({
        onDragStart({ active }) {
            const source = active.data.current?.source as DraggableBlock | undefined;
            if (saving.current || !source) return;
            const block = source;
            drag.current = { block, locationKey };
            setDraggingBlock(block);
        },
        onDragOver: showPreview,
        onDragMove: showPreview,
        onDragCancel: clearDrag,
        async onDragEnd(event) {
            const currentDrag = drag.current;
            clearDrag();
            if (!currentDrag || currentDrag.locationKey !== locationKey) return;

            const source = currentDrag.block;
            const destination = event.over?.id;
            if (destination === TEMPLATE_BLOCKS_AREA_ID && !source.fromTemplateBlockSource) {
                const template = { title: source.title, width: source.width, color: source.color };
                setSaving(true);
                try {
                    const id = await registerTemplateBlock(template);
                    setTemplateBlocks(blocks => [...blocks, { ...template, id }]);
                } catch {
                    enqueueSnackbar("テンプレートを作成できませんでした。", { variant: "error" });
                } finally {
                    setSaving(false);
                }
                return;
            }

            if (destination !== TIMETABLE_ID && destination !== BLOCKS_AREA_ID) return;
            if (destination === BLOCKS_AREA_ID && source.status === "HOLD" && !source.fromTemplateBlockSource) return;

            const startAt = getDropTime(event, source);
            if (destination === TIMETABLE_ID && !startAt) {
                enqueueSnackbar("ブロックを配置できる時刻にドロップしてください。", { variant: "error" });
                return;
            }
            if (!source.fromTemplateBlockSource && !source.id) return;

            const input: TimeBlockInput = {
                title: source.title,
                width: source.width,
                color: source.color,
                tasks: source.tasks,
                status: destination === TIMETABLE_ID ? "PLACED" : "HOLD",
                timeTableId: destination === TIMETABLE_ID ? timeTableId : null,
                startAt,
            };
            setSaving(true);
            try {
                let id: number;
                if (source.fromTemplateBlockSource) {
                    id = await registerTimeBlock(input);
                } else {
                    id = source.id;
                    await updateTimeBlock({ ...input, id });
                }
                const moved: TimeBlockSource = { ...input, id };

                const withoutMoved = (blocks: TimeBlockSource[]) => blocks.filter(block => block.id !== moved.id);
                setBlocksAtField(blocks => moved.status === "HOLD"
                    ? [...withoutMoved(blocks), moved]
                    : withoutMoved(blocks));
                if (activeTable.current.locationKey !== locationKey || activeTable.current.timeTableId !== timeTableId) {
                    // 保存前に移動先日付の取得が始まっている場合は再取得する。
                    setTableRevision(revision => revision + 1);
                } else {
                    setBlocksOnTable(blocks => moved.status === "PLACED"
                        ? [...withoutMoved(blocks), moved]
                        : withoutMoved(blocks));
                }
            } catch {
                enqueueSnackbar("ブロックを移動できませんでした。", { variant: "error" });
            } finally {
                setSaving(false);
            }
        },
    });

    return (
        <BlockRepositories value={{
            blocksOnTable,
            setBlocksOnTable,
            previewBlock,
            tableRevision,
            blocksAtField,
            setBlocksAtField,
            templateBlocks,
            setTemplateBlocks,
        }}>
            {children}
            <Backdrop
                open={isSaving}
                sx={{ color: "common.white", zIndex: theme => theme.zIndex.modal + 1 }}
                role="status"
                aria-label="ブロックを保存中"
                aria-busy={isSaving}
            >
                <CircularProgress color="inherit" />
            </Backdrop>
            <DragOverlay dropAnimation={null} style={{ pointerEvents: "none" }}>
                {draggingBlock && <TimeBlockView source={draggingBlock} sx={{ opacity: previewBlock ? 0 : 1 }} />}
            </DragOverlay>
        </BlockRepositories>
    );
};

export default BlockAvailable;
