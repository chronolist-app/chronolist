import { useContext, useCallback, type FC, type ReactElement, useEffect, useState} from "react";
import { useDroppable } from "@dnd-kit/core";
import { Box, Stack, Typography } from "@mui/material";

import { Time } from "@/utils/time";
import { TIMETABLE_ID } from "../static/droppableId";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import type { TimeBlockSource } from "../types/blockSourceTypes";
import TimeBlock from "./TimeBlock";
import Legend from "./timeTableComponents/Legend";
import BlockRepositories from "../contexts/BlockRepositories";
import { useLocation, useNavigate } from "react-router-dom";
import { createAt, getByDate } from "../api/timeTableApi";
import type { TimeTableSource } from "../types/timeTableSource";
import { AxiosError } from "axios";
import { NotFoundError } from "@/error/common";
import { toDateString } from "@/utils/date";

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
    } = useContext(BlockRepositories);

    const {
        gridSize,
        tableHeight,
        tableWidth,
        slotHeight,
    } = useContext(TimeTableConfigure);

    const {
        setNodeRef,
    } = useDroppable({
        id: TIMETABLE_ID,
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
        const isConflict = (block1: TimeBlockSource, block2: TimeBlockSource) => {
            type startAndEnd = {start: Time, end: Time};
            const b1: startAndEnd = {start: block1.startAt!, end: new Time(block1.startAt!.toMinutes() + block1.width)};
            const b2: startAndEnd = {start: block2.startAt!, end: new Time(block2.startAt!.toMinutes() + block2.width)};
            return b1.start < b2.end && b1.end > b2.start;
        }

        
        // 衝突が起こっているブロック同士をグルーピング
        let blockGroups: TimeBlockSource[][] = [];
        let prevBlock: TimeBlockSource | null = null;
        let prevGroup: TimeBlockSource[] = [];
        for(const block of blocksOnTable.sort((b1, b2) => b1.startAt!.toMinutes() - b2.startAt!.toMinutes())){
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
            let columns: TimeBlockSource[][] = [];
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
        </Box>
    )
}


const TimeTable: FC = () => {

    const {
        setTimeTableId,
    } = useContext(TimeTableConfigure);

    const {
        setBlocksOnTable,
    } = useContext(BlockRepositories);

    const [ table, setTable ] = useState<TimeTableSource>();

    const location = useLocation();
    const nav = useNavigate();
    useEffect(() => {
        const query = new URLSearchParams(location.search);
        // useNavigate で渡された state またはURLのクエリパラメータから日付を取得
        // 日付を取得できない場合は今日の日付を取得
        const date = 
            (location.state?.date as (string | undefined)) || 
            query.get("date") ||
            toDateString(new Date());

        // テスト用ログ
        console.log("date: ", date);

        getByDate(date)
            .then(res => {setTable(res);})
            .catch(e => {
                if (e instanceof NotFoundError) {
                    console.log("タイムテーブルが見つからなかったため、新しく作成します")
                    createAt(date).then(() => {nav("/timeblocking", { state: { date } });});
                } else {
                    throw e;
                }
            });
    }, [ location ]);

    useEffect(() => {
        if (table) {
            setBlocksOnTable(table.blocks);
            setTimeTableId(table.id);
        }
    }, [ table ]);

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
