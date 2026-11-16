import RegionLoadFeedback from "./RegionLoadFeedback";
import { loadRegion } from "../utils/load-region";
import type { RegionLoadStatus } from "../types/regionLoadTypes";
import { useContext, useLayoutEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";

import BlockRepositories from "../contexts/BlockRepositories";
import TimeBlock from "./TimeBlock";
import { BLOCKS_AREA_ID } from "../static/droppableId";
import { Paper, Grid, Stack } from "@mui/material";
import CreateBlockButton from "./CreateBlockButton";
import { getHoldBlocks } from "../api/timeBlockApi";


/** HOLDブロックの取得状況と一覧を表示する。 */
const BlocksArea = () => {
    const {
        blocksAtField,
        setBlocksAtField
    } = useContext(BlockRepositories);

    const [loadStatus, setLoadStatus] = useState<RegionLoadStatus>("loading");
    const [retryCount, setRetryCount] = useState(0);

    useLayoutEffect(() => loadRegion(getHoldBlocks, setBlocksAtField, setLoadStatus), [setBlocksAtField, retryCount]);

    const {
        setNodeRef,
    } = useDroppable({
        id: BLOCKS_AREA_ID,
        disabled: loadStatus !== "success",
    });

    return (
        <>
            <Paper
                ref={setNodeRef}
                aria-label="HOLDブロック"
                aria-busy={loadStatus === "loading"}
                sx = {{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    padding: 1,
                    backgroundColor: "lightgreen",
                    overflowY: "auto",
                }}
            >
                <RegionLoadFeedback status={loadStatus} label="HOLDブロック" onRetry={() => setRetryCount(count => count + 1)} />
                {loadStatus === "success" && <Stack spacing={1} sx={{width: "100%"}}>
                    <Stack alignItems={"end"}>
                        <CreateBlockButton />
                    </Stack>
                    <Grid container spacing={1}>
                        {blocksAtField.map(b => (
                            <Grid key={b.id} size={6}>
                                <TimeBlock key={b.id} source={b} />
                            </Grid>
                        ))}
                    </Grid>
                </Stack>}
            </Paper>
        </>
    )
};

export default BlocksArea;
