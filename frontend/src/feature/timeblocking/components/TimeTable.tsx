import { useContext, useCallback, type FC, type ReactElement, useLayoutEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { isAxiosError } from "axios";

import type { Time } from "@/utils/time";
import { TIMETABLE_ID } from "../static/droppableId";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import type { TimeBlockSource } from "../types/blockSourceTypes";
import TimeBlock from "./TimeBlock";
import TimeBlockView from "./TimeBlockView";
import Legend from "./timeTableComponents/Legend";
import BlockRepositories from "../contexts/BlockRepositories";
import { useLocation } from "react-router-dom";
import { createAt, getByDate } from "../api/timeTableApi";
import type { TimeTableSource } from "../types/timeTableSource";
import { NotFoundError } from "@/error/common";
import { toDateString } from "@/utils/date";

type PositionedBlock = TimeBlockSource & { startAt: Time };

const isPositionedBlock = (block: TimeBlockSource): block is PositionedBlock => {
    if (block.status !== "PLACED" || !block.startAt) return false;
    const minutes = block.startAt.toMinutes();
    return minutes >= 0 && minutes < 24 * 60;
};

/**
 * タイムテーブル本体を描画するコンポーネント.
 *   
 * {@link BlockRepositories} コンテキストで提供された `blocksOnTable` に  
 * 基づいてタイムテーブルを描画する.  
 * {@link useDroppable} を使用してドラッグ先として利用可能なコンポーネントとして  
 * 実装されており, {@link TimeBlock} を設置できる.  
 */
const Table: FC = () => {

    const {
        blocksOnTable,
        previewBlock,
    } = useContext(BlockRepositories);

    const {
        gridSize,
        tableHeight,
        tableWidth,
        slotHeight,
        slotMinutes,
        timeTableId,
    } = useContext(TimeTableConfigure);

    const {
        setNodeRef,
    } = useDroppable({
        id: TIMETABLE_ID,
        disabled: timeTableId <= 0,
    });

    /**
     * タイムスケジュール上にて, ブロックに重複が発生しているかどうかによってブロックを  
     * グルーピングし, 分割して表示するための関数.
     */
    const blocksOnTableSorted = useCallback(() => {
        /**
         * ２つのブロックが時間軸上で重複しているかどうか比較し, 結果を返す関数
         * 
         * @param block1 重複しているかどうか比較するブロック1
         * @param block2 重複しているかどうか比較するブロック2
         * @returns 重複しているかどうか. している場合に `true` を返す
         */
        const isConflict = (block1: PositionedBlock, block2: PositionedBlock) => {
            const firstStart = block1.startAt.toMinutes();
            const secondStart = block2.startAt.toMinutes();
            return firstStart < secondStart + block2.width && firstStart + block1.width > secondStart;
        }

        
        // 衝突が起こっているブロック同士をグルーピング
        let blockGroups: PositionedBlock[][] = [];
        let prevBlock: PositionedBlock | null = null;
        let prevGroup: PositionedBlock[] = [];
        const positionedBlocks = blocksOnTable.filter(isPositionedBlock);
        for (const block of positionedBlocks.sort((b1, b2) => b1.startAt.toMinutes() - b2.startAt.toMinutes())) {
            if (!prevBlock) {
                prevBlock = block;
                prevGroup = [block];
                continue;
            }
            if (isConflict(prevBlock, block)) {
                prevGroup = [...prevGroup, block];
            } else {
                blockGroups = [...blockGroups, prevGroup];
                prevGroup = [block];
            }
            prevBlock = block;
        }
        if (prevGroup.length > 0) {
            blockGroups = [...blockGroups, prevGroup];
        }

        // 衝突が起こっているかどうかによって分割したタイムブロックのノードのリストを作成
        let blockNodes: ReactElement[] = [];
        for(const group of blockGroups) {
            const columns: PositionedBlock[][] = [];
            for(const block of group) {
                for(let i = 0; i < group.length; i++) {
                    if (!columns[i]) {
                        columns[i] = [block];
                        break;
                    }
                    if (!columns[i].some(b => isConflict(b, block))) {
                        columns[i] = [...columns[i], block];
                        break;
                    }
                }
            }
            columns.forEach((col, index) => {
                blockNodes = [
                    ...blockNodes,
                    ...col.map(b => <TimeBlock key={b.clientId} source={b} conlumnIndex={index} maxColumnIndex={columns.length}/>)
                ];
            });
        }
        return blockNodes;
    }, [blocksOnTable]);

    return (
        <Box
            ref={setNodeRef} 
            sx={{
                height: tableHeight,
                border: gridSize,
                width: tableWidth,
                backgroundImage: `repeating-linear-gradient(180deg, white 0 ${slotHeight - gridSize}px, black ${slotHeight - gridSize}px ${slotHeight}px)`,
                position: "relative",
            }}
        >
            {blocksOnTableSorted()}
            {previewBlock?.startAt && previewBlock.timeTableId === timeTableId && (
                <TimeBlockView source={previewBlock} sx={{
                    position: "absolute",
                    top: previewBlock.startAt.toMinutes() * slotHeight / slotMinutes,
                    width: "100%",
                    opacity: 0.6,
                    pointerEvents: "none",
                    zIndex: 1,
                }} />
            )}
        </Box>
    )
}


const TimeTable: FC = () => {

    const {
        setTimeTableId,
    } = useContext(TimeTableConfigure);

    const {
        setBlocksOnTable,
        tableRevision,
    } = useContext(BlockRepositories);

    const [ table, setTable ] = useState<TimeTableSource>();
    const [loadError, setLoadError] = useState(false);

    const location = useLocation();
    useLayoutEffect(() => {
        const query = new URLSearchParams(location.search);
        // useNavigate で渡された state またはURLのクエリパラメータから日付を取得
        // 日付を取得できない場合は今日の日付を取得
        const date = 
            (location.state?.date as (string | undefined)) || 
            query.get("date") ||
            toDateString(new Date());

        let ignore = false;
        setTable(undefined);
        setLoadError(false);
        setTimeTableId(-1);
        setBlocksOnTable([]);

        const loadTable = async () => {
            try {
                return await getByDate(date);
            } catch (error) {
                if (ignore || !(error instanceof NotFoundError)) throw error;
                try {
                    await createAt(date);
                } catch (createError) {
                    if (!isAxiosError(createError) || createError.response?.status !== 409) throw createError;
                }
                return getByDate(date);
            }
        };

        loadTable().then(result => {
            if (ignore) return;
            setTable(result);
            setBlocksOnTable(result.blocks.filter(block => block.timeTableId === result.id && isPositionedBlock(block)));
            setTimeTableId(result.id);
        }).catch(() => {
            if (!ignore) setLoadError(true);
        });

        return () => { ignore = true; };
    }, [location, setBlocksOnTable, setTimeTableId, tableRevision]);

    return (
        <Box
            sx={{
                overflowY: "scroll",
                overflowX: "hidden",
                height: "100%",
                p: 4,
                border: 1,
            }}
        >
            <Typography sx={{fontSize: 30}}>{table && toDateString(table.date)}</Typography>
            {loadError && <Alert severity="error">タイムテーブルを読み込めませんでした。</Alert>}
            <Stack
                direction={"row"}
                alignItems={"flex-start"}
            >
                <Legend />
                <Table/>
            </Stack>
        </Box>
    )
}

export default TimeTable;
