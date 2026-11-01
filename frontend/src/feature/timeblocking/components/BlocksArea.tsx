import { useContext, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";

import BlockRepositories from "../contexts/BlockRepositories";
import TimeBlock from "./TimeBlock";
import { BLOCKS_AREA_ID } from "../static/droppableId";
import { Paper, Grid, Stack } from "@mui/material";
import CreateBlockButton from "./CreateBlockButton";
import { getHoldBlocks } from "../api/timeBlockApi";


const BlocksArea = () => {
    const {
        blocksAtField,
        setBlocksAtField
    } = useContext(BlockRepositories);

    useEffect(() => {
        getHoldBlocks()
            .then(blocks => setBlocksAtField(blocks))
            .catch((e) => {throw e});
    }, [setBlocksAtField]);

    const {
        setNodeRef,
    } = useDroppable({
        id: BLOCKS_AREA_ID,
    });

    return (
        <>
            <Paper
                ref={setNodeRef}
                sx = {{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    padding: 1,
                    backgroundColor: "lightgreen",
                    overflowY: "auto",
                }}
            >
                <Stack spacing={1} sx={{width: "100%"}}>
                    <Stack alignItems={"end"}>
                        <CreateBlockButton />
                    </Stack>
                    <Grid container spacing={1}>
                        {blocksAtField.map(b => (
                            <Grid key={b.clientId} size={6}>
                                <TimeBlock key={b.clientId} source={b} />
                            </Grid>
                        ))}
                    </Grid>
                </Stack>
            </Paper>
        </>
    )
};

export default BlocksArea;
