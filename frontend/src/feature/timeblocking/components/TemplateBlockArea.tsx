import RegionLoadFeedback from "./RegionLoadFeedback";
import { loadRegion } from "../utils/load-region";
import type { RegionLoadStatus } from "../types/regionLoadTypes";
import { useContext, useLayoutEffect, useState } from "react"
import BlockRepositories from "../contexts/BlockRepositories"
import { Paper, Grid, Stack } from "@mui/material";
import { useDroppable } from "@dnd-kit/core";
import { TEMPLATE_BLOCKS_AREA_ID } from "../static/droppableId";
import TemplateBlock from "./TemplateBlock";
import CreateTemplateBlockButton from "./CreateTemplateBlockButton";
import { getAll } from "../api/templateBlockApi";


/** テンプレートブロックの取得状況と一覧を表示する。 */
const TemplateBlockArea = () => {
    const {
        templateBlocks,
        setTemplateBlocks
    } = useContext(BlockRepositories);

    const [loadStatus, setLoadStatus] = useState<RegionLoadStatus>("loading");
    const [retryCount, setRetryCount] = useState(0);

    useLayoutEffect(() => loadRegion(getAll, setTemplateBlocks, setLoadStatus), [setTemplateBlocks, retryCount]);

    const {
        setNodeRef,
    } = useDroppable({
        id: TEMPLATE_BLOCKS_AREA_ID,
        disabled: loadStatus !== "success",
    });


    return (
        
        <Paper
            ref={setNodeRef}
            aria-label="テンプレートブロック"
            aria-busy={loadStatus === "loading"}
            sx={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                padding: 1,
                backgroundColor: "lightblue",
                overflowY: "auto",
            }}
        >
            <RegionLoadFeedback status={loadStatus} label="テンプレートブロック" onRetry={() => setRetryCount(count => count + 1)} />
            {loadStatus === "success" && <Stack spacing={1} sx={{width: "100%"}}>
                <Stack alignItems={"end"}>
                    <CreateTemplateBlockButton />
                </Stack>
                <Grid container spacing={1}>
                    {templateBlocks.map(b => (
                        <Grid key={b.clientId} size={6}>
                            <TemplateBlock source={b} />
                        </Grid>
                    ))}
                </Grid>
            </Stack>}
            
        </Paper>
    )
}

export default TemplateBlockArea;
