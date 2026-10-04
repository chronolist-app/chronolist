import { defaultDropAnimationSideEffects, DragOverlay, useDndMonitor } from "@dnd-kit/core"
import { useRef, type FC, type ReactElement, useContext, useCallback, useState } from "react"
import { v4 as uuidv4 } from "uuid";

import type { TemplateBlockSource, TimeBlockSource } from "../types/blockSourceTypes";
import { Time } from "@/utils/time";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import { PREVIEW_BLOCK_ID } from "../static/previewBlock";
import BlockRepositories from "../contexts/BlockRepositories";
import TimeBlockView from "./TimeBlockView";
import { BLOCKS_AREA_ID, TEMPLATE_BLOCKS_AREA_ID, TIMETABLE_ID } from "../static/droppableId";
import { register as registerTemplateBlock } from "../api/templateBlockApi";
import { register as registerTimeBlock, update as updateTimeBlock } from "../api/timeBlockApi";

const testBlocksAtField: TimeBlockSource[] = [{
        id: 1,
        clientId: uuidv4(),
        timeTableId: null,
        status: "HOLD",
        relatedSchedle: null,
        width: 120,
        startAt: null,
        tasks: [
            { id: 1, clientId: uuidv4(), timeBlockId: 1, title: "test task 1" },
            { id: 2, clientId: uuidv4(), timeBlockId: 1, title: "test task 2" },
        ],
        color: "red",
        title: "test block 1 test block 2 test block 3 test block 4",
    },
    {
        id: 2,
        clientId: uuidv4(),
        timeTableId: null,
        status: "HOLD",
        relatedSchedle: null,
        width: 150,
        startAt: null,
        tasks: [],
        color: "red",
        title: "test block 2",
    }
];

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
}

/**
 * ブロックを配置可能なエリアの外枠.  
 * このコンポーネント内でブロックがドラッグ・ドロップされた際の処理を行う.  
 */
const BlockAvailable: FC<BlockAvailableProps> = ({children}) => {

    const [ blocksOnTable, setBlocksOnTable ] = useState<TimeBlockSource[]>([]);
    const [ blocksAtField, setBlocksAtField ] = useState<TimeBlockSource[]>(testBlocksAtField);
    const [ templateBlocks, setTemplateBlocks ] = useState<TemplateBlockSource[]>(testTemplateBlocks);

    const prevPointTimeRef = useRef<Time | null>(null);
    const draggingBlockSource = useRef<TimeBlockSource | null>(null);

    const {
        timeTableId,
        slotHeight,
        slotMinutes,
    } = useContext(TimeTableConfigure);

    const pointToTime = useCallback((relativePointerY: number) => {
        const time = new Time(Math.floor(relativePointerY / slotHeight) * slotMinutes);
        return time;
    }, [slotHeight, slotMinutes]);

    const createPrevBlockSorce = useCallback((startAt: Time, originalSource: TimeBlockSource): TimeBlockSource => {
        return {
            ...originalSource,
            clientId: PREVIEW_BLOCK_ID,
            timeTableId: timeTableId,
            status: "PLACED",
            startAt,
        };
    }, [timeTableId]);
    
    /**
     * プレビューブロックを削除する
     */
    const removePrevBlock = useCallback(() => {
        prevPointTimeRef.current = null;
        setBlocksOnTable((blocks) => blocks.filter(b => b.clientId !== PREVIEW_BLOCK_ID));
        console.log("prevBlock removed");
    }, [setBlocksOnTable]);

    /**
     * プレビューブロックを表示する
     */
    const showPrevBlock = useCallback((startAt: Time, originalSource: TimeBlockSource) => {
        setBlocksOnTable((blocks) => [
            ...blocks.filter(b => b.clientId !== originalSource.clientId),
            createPrevBlockSorce(startAt, originalSource)
        ]);
        prevPointTimeRef.current = startAt;
        console.log("prevBlock shown");
    }, [setBlocksOnTable, createPrevBlockSorce]);

    /**
     * プレビューブロックを移動する
     */
    const movePrevBlock = useCallback((startAt: Time) => {
        // エラー処理
        if (prevPointTimeRef.current === null) {
            console.log("prevPointTime is null");
            return;
        };
        if (draggingBlockSource.current === null) {
            console.log("draggingBlockSource is null");
            return;
        };

        // カーソル移動時でも, 同じ時刻の範囲ならば何もしない(負荷軽減)
        if (prevPointTimeRef.current.toMinutes() === startAt.toMinutes()) return;

        const movedPrevBlockSource: TimeBlockSource = createPrevBlockSorce(startAt, draggingBlockSource.current);
        setBlocksOnTable((blocks) => blocks.map(b => b.clientId === PREVIEW_BLOCK_ID ? movedPrevBlockSource : b));
        prevPointTimeRef.current = startAt;
    }, [createPrevBlockSorce]);

    useDndMonitor({
        onDragStart(event) {
            if (!event.active?.data?.current) return;
            const dbs = { ...event.active.data.current.source } as TimeBlockSource;
            if (dbs.fromTemplateBlockSource) {
                dbs.clientId = uuidv4();
            };
            draggingBlockSource.current = dbs;
        },
        onDragMove(event) {
            switch (event.over?.id) {
                case TIMETABLE_ID: {
                    if (prevPointTimeRef.current === null) {
                        console.log("prevPointTime is null");
                        return;
                    };
                    if (!event.over?.rect.top || !event.active?.rect?.current?.translated || !event.active.data.current) {
                        console.log("Invalid event");
                        return;
                    };
                    const cursorTime = pointToTime(event.active.rect.current.translated.top - event.over.rect.top);
                    // カーソル操作時, そのカーソルに対応した時刻を出力するテスト用のコード
                    // テスト時に便利なため残しておく
                    // console.log(`cursorTime: ${cursorTime}`);

                    movePrevBlock(cursorTime);
                    break;
                }
                case BLOCKS_AREA_ID: {
                    break;
                }
                case TEMPLATE_BLOCKS_AREA_ID: {
                    break;
                }
            }
        },
        onDragOver(event) {
            switch (event.over?.id) {
                case TIMETABLE_ID: {
                    // ドラッグオーバー開始時にプレビューブロックを表示
                    if (draggingBlockSource.current === null) throw new Error("draggingBlockSource is null");
                    if (!event.over.rect.top || !event.active?.rect?.current?.translated) {
                        console.log("Invalid event");
                        return;
                    };
                    const cursorTime = pointToTime(event.active.rect.current.translated.top - event.over.rect.top);
                    showPrevBlock(cursorTime, draggingBlockSource.current);
                    break;
                }
                case BLOCKS_AREA_ID: {
                    removePrevBlock();
                    break;
                }
                case TEMPLATE_BLOCKS_AREA_ID: {
                    removePrevBlock();
                    break;
                }
            }
        },
        async onDragEnd(e) {
            if (draggingBlockSource.current === null) {
                throw new Error("draggingBlockSource is null");
            }
            const movedBlockSource: TimeBlockSource = draggingBlockSource.current;
            switch (e.over?.id) {
                case TIMETABLE_ID: {
                    const newBlockSource: TimeBlockSource = {
                        ...movedBlockSource,
                        startAt: prevPointTimeRef.current,
                        timeTableId,
                        status: "PLACED",
                        fromTemplateBlockSource: undefined,
                    };
                    setBlocksAtField((blocks) => blocks.filter(block => block.clientId !== movedBlockSource.clientId));
                    setBlocksOnTable((blocks) => [...blocks, newBlockSource]);

                    // テンプレートブロックからの移動ならば新規登録
                    if (movedBlockSource.fromTemplateBlockSource) {
                        registerTimeBlock(newBlockSource)
                            .then((id) => newBlockSource.id = id)
                            .catch((e) => {throw e});
                    } else {
                        updateTimeBlock(newBlockSource)
                            .catch((e) => {throw e});
                    }
                    break;
                }
                case BLOCKS_AREA_ID: {
                    if (!blocksAtField.find(b => b.clientId === movedBlockSource.clientId)) {
                        const heldBlockSource: TimeBlockSource = {
                            ...draggingBlockSource.current,
                            status: "HOLD",
                            startAt: null,
                            timeTableId: null,
                            fromTemplateBlockSource: undefined,
                        };
                        console.log("heldBlockSource", heldBlockSource);
                        setBlocksAtField((blocks) => [...blocks, heldBlockSource]);
                        // テンプレートブロックからの移動ならば新規登録
                        if (movedBlockSource.fromTemplateBlockSource) {
                            registerTimeBlock(heldBlockSource)
                                .then((id) => heldBlockSource.id = id)
                                .catch((e) => {throw e});
                        } else {
                            updateTimeBlock(heldBlockSource)
                                .catch((e) => {throw e});
                        }
                    };
                    break;
                }
                case TEMPLATE_BLOCKS_AREA_ID: {
                    if (movedBlockSource.fromTemplateBlockSource) return;
                    const newTemplateBlock: TemplateBlockSource = {
                        ...draggingBlockSource.current,
                        id: undefined,
                    };
                    setBlocksAtField((blocks) => blocks.filter(block => block.clientId !== movedBlockSource.clientId));
                    setTemplateBlocks((blocks) => [...blocks, newTemplateBlock]);
                    newTemplateBlock.id = await registerTemplateBlock(newTemplateBlock);
                    break;
                }
            }
            draggingBlockSource.current = null;
            removePrevBlock();
        },
        onDragCancel() {
            console.log("Dragging Cancelled");
            removePrevBlock();
            draggingBlockSource.current = null;
        },
    });

    return (
        <BlockRepositories value={{
            blocksOnTable,
            setBlocksOnTable,
            blocksAtField,
            setBlocksAtField,
            templateBlocks,
            setTemplateBlocks
        }}>
            {children}
            <DragOverlay
                dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {},
                            dragOverlay: {
                                opacity: "0",
                            }
                        }
                    })
                }}
            >
                {draggingBlockSource.current && <TimeBlockView source={draggingBlockSource.current} sx={{opacity: prevPointTimeRef.current ? 0 : 1}} />}
            </DragOverlay>
        </BlockRepositories>
    )
};

export default BlockAvailable;