import { useContext, type FC, useLayoutEffect, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Alert, Box, Typography } from "@mui/material";
import { isAxiosError } from "axios";

import { TIMETABLE_ID } from "../static/droppableId";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import TimeBlock from "./TimeBlock";
import TimeBlockView from "./TimeBlockView";
import Legend from "./timeTableComponents/Legend";
import ScheduleArea from "./timeTableComponents/ScheduleArea";
import BlockRepositories from "../contexts/BlockRepositories";
import { useLocation } from "react-router-dom";
import { createAt, getByDate } from "../api/timeTableApi";
import type { TimeTableSource } from "../types/timeTableSource";
import { NotFoundError } from "@/error/common";
import { toDateString } from "@/utils/date";
import { getTimeBlockLayout, isPositionedBlock } from "../utils/timeBlockLayout";

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

    const blockLayout = useMemo(() => getTimeBlockLayout(blocksOnTable), [blocksOnTable]);

    return (
        <Box
            ref={setNodeRef}
            sx={{
                gridArea: "table",
                width: tableWidth,
                boxShadow: `inset -${gridSize}px 0 currentColor`,
                position: "relative",
            }}
        >
            {blockLayout.map(({ block, columnIndex, columnCount }) => (
                <TimeBlock key={block.clientId} source={block} conlumnIndex={columnIndex} maxColumnIndex={columnCount} />
            ))}
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
        gridSize,
        slotHeight,
        tableHeight,
        setTimeTableId,
    } = useContext(TimeTableConfigure);

    const {
        setBlocksOnTable,
        tableRevision,
    } = useContext(BlockRepositories);

    const [ table, setTable ] = useState<TimeTableSource>();
    const [loadError, setLoadError] = useState(false);

    const location = useLocation();
    const date = useMemo(() => {
        const query = new URLSearchParams(location.search);
        // useNavigate で渡された state またはURLのクエリパラメータから日付を取得
        // 日付を取得できない場合は今日の日付を取得
        return (
            (location.state?.date as (string | undefined)) || 
            query.get("date") ||
            toDateString(new Date())
        );
    }, [location]);

    useLayoutEffect(() => {
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
    }, [date, location, setBlocksOnTable, setTimeTableId, tableRevision]);

    return (
        <Box
            sx={{
                overflowY: "scroll",
                overflowX: "hidden",
                height: "100%",
                px: { xs: 1, sm: 2, md: 4 },
                py: 4,
                border: 1,
            }}
        >
            <Typography sx={{fontSize: 30}}>{table && toDateString(table.date)}</Typography>
            {loadError && <Alert severity="error">タイムテーブルを読み込めませんでした。</Alert>}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateAreas: '". scheduleHeading tableHeading" "legend schedule table"',
                    gridTemplateColumns: "max-content minmax(0, 1fr) minmax(0, 3fr)",
                    gridTemplateRows: `auto ${tableHeight}px`,
                }}
            >
                <Typography component="h2" variant="subtitle2" sx={{ gridArea: "scheduleHeading", px: { xs: 0, sm: 0.5 }, overflowWrap: "anywhere" }}>
                    予定
                </Typography>
                <Typography component="h2" variant="subtitle2" sx={{ gridArea: "tableHeading", px: 0.5, overflowWrap: "anywhere" }}>
                    タイムブロック
                </Typography>
                <Legend />
                <Box
                    sx={{
                        gridColumn: "schedule-start / table-end",
                        gridRow: "schedule-start / schedule-end",
                        position: "relative",
                        backgroundImage: `repeating-linear-gradient(180deg, currentColor 0 ${gridSize}px, transparent ${gridSize}px ${slotHeight}px)`,
                        "&::after": {
                            content: '""',
                            position: "absolute",
                            top: "100%",
                            insetInline: 0,
                            height: `${gridSize}px`,
                            bgcolor: "currentColor",
                        },
                    }}
                />
                <ScheduleArea key={date} date={date} />
                <Table />
            </Box>
        </Box>
    )
}

export default TimeTable;
