import { DragOverlay, useDndMonitor, type DragEndEvent } from "@dnd-kit/core";
import { Alert, Snackbar } from "@mui/material";
import { useContext, useLayoutEffect, useRef, useState, type FC, type ReactElement } from "react";
import { useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import type { TemplateBlockSource, TimeBlockSource } from "../types/blockSourceTypes";
import { Time } from "@/utils/time";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import BlockRepositories from "../contexts/BlockRepositories";
import TimeBlockView from "./TimeBlockView";
import { BLOCKS_AREA_ID, TEMPLATE_BLOCKS_AREA_ID, TIMETABLE_ID } from "../static/droppableId";
import { register as registerTemplateBlock } from "../api/templateBlockApi";
import { register as registerTimeBlock, update as updateTimeBlock } from "../api/timeBlockApi";
import { getDropStartMinutes } from "../utils/dropTime";

const testTemplateBlocks: TemplateBlockSource[] = [
    {
        id: 1,
        clientId: uuidv4(),
        title: "test template block 1",
        width: 120,
        color: "cyan",
    },
    {
        id: 2,
        clientId: uuidv4(),
        title: "test template block 2",
        width: 150,
        color: "cyan",
    }
];

type BlockAvailableProps = {
    children?: ReactElement[],
};

const BlockAvailable: FC<BlockAvailableProps> = ({ children }) => {
    const [blocksOnTable, setBlocksOnTable] = useState<TimeBlockSource[]>([]);
    const [blocksAtField, setBlocksAtField] = useState<TimeBlockSource[]>([]);
    const [templateBlocks, setTemplateBlocks] = useState<TemplateBlockSource[]>(testTemplateBlocks);
    const [draggingBlock, setDraggingBlock] = useState<TimeBlockSource | null>(null);
    const [previewBlock, setPreviewBlock] = useState<TimeBlockSource | null>(null);
    const [tableRevision, setTableRevision] = useState(0);
    const [saveError, setSaveError] = useState<string | null>(null);

    const drag = useRef<{ block: TimeBlockSource, locationKey: string } | null>(null);
    const saving = useRef(false);
    const { timeTableId, slotHeight, slotMinutes } = useContext(TimeTableConfigure);
    const { key: locationKey } = useLocation();
    const activeTable = useRef({ timeTableId, locationKey });

    useLayoutEffect(() => {
        activeTable.current = { timeTableId, locationKey };
    }, [timeTableId, locationKey]);

    const getDropTime = ({ active, over }: Pick<DragEndEvent, "active" | "over">, source: TimeBlockSource) => {
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
            const source = active.data.current?.source as TimeBlockSource | undefined;
            if (saving.current || !source) return;
            const block = source.fromTemplateBlockSource
                ? { ...source, clientId: uuidv4(), id: undefined }
                : source;
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
                const template = { title: source.title, width: source.width, color: source.color, clientId: uuidv4() };
                saving.current = true;
                try {
                    const id = await registerTemplateBlock(template);
                    setTemplateBlocks(blocks => [...blocks, { ...template, id }]);
                } catch {
                    setSaveError("テンプレートを作成できませんでした。");
                } finally {
                    saving.current = false;
                }
                return;
            }

            if (destination !== TIMETABLE_ID && destination !== BLOCKS_AREA_ID) return;
            if (destination === BLOCKS_AREA_ID && source.status === "HOLD" && !source.fromTemplateBlockSource) return;

            const startAt = getDropTime(event, source);
            if (destination === TIMETABLE_ID && !startAt) {
                setSaveError("ブロックを配置できる時刻にドロップしてください。");
                return;
            }
            if (!source.fromTemplateBlockSource && !source.id) return;

            const moved: TimeBlockSource = {
                ...source,
                status: destination === TIMETABLE_ID ? "PLACED" : "HOLD",
                timeTableId: destination === TIMETABLE_ID ? timeTableId : null,
                startAt,
                fromTemplateBlockSource: undefined,
            };
            saving.current = true;
            setSaveError(null);
            try {
                if (source.fromTemplateBlockSource) {
                    moved.id = await registerTimeBlock(moved);
                } else {
                    await updateTimeBlock(moved);
                }

                const withoutMoved = (blocks: TimeBlockSource[]) => blocks.filter(block => block.id !== moved.id);
                setBlocksAtField(blocks => moved.status === "HOLD"
                    ? [...withoutMoved(blocks), moved]
                    : withoutMoved(blocks));
                if (activeTable.current.locationKey !== locationKey || activeTable.current.timeTableId !== timeTableId) {
                    // A fetch for the newly selected date may have started before the save.
                    setTableRevision(revision => revision + 1);
                } else {
                    setBlocksOnTable(blocks => moved.status === "PLACED"
                        ? [...withoutMoved(blocks), moved]
                        : withoutMoved(blocks));
                }
            } catch {
                setSaveError("ブロックを移動できませんでした。");
            } finally {
                saving.current = false;
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
            <DragOverlay dropAnimation={null} style={{ pointerEvents: "none" }}>
                {draggingBlock && <TimeBlockView source={draggingBlock} sx={{ opacity: previewBlock ? 0 : 1 }} />}
            </DragOverlay>
            <Snackbar open={saveError !== null} autoHideDuration={5000} onClose={() => setSaveError(null)}>
                <Alert severity="error" onClose={() => setSaveError(null)}>{saveError}</Alert>
            </Snackbar>
        </BlockRepositories>
    );
};

export default BlockAvailable;
