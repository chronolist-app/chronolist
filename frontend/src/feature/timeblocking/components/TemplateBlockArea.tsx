import { useContext, useEffect } from "react"
import BlockRepositories from "../contexts/BlockRepositories"
import { Paper, Grid, Stack } from "@mui/material";
import { useDroppable } from "@dnd-kit/core";
import { TEMPLATE_BLOCKS_AREA_ID } from "../static/droppableId";
import TemplateBlock from "./TemplateBlock";
import CreateTemplateBlockButton from "./CreateTemplateBlockButton";
import { getAll } from "../api/templateBlockApi";


const TemplateBlockArea = () => {
    const {
        templateBlocks,
        setTemplateBlocks
    } = useContext(BlockRepositories);

    const {
        setNodeRef,
    } = useDroppable({
        id: TEMPLATE_BLOCKS_AREA_ID,
    });

    useEffect(() => {
        getAll()
            .then(templateBlockSources => {
                setTemplateBlocks(templateBlockSources);
            })
            .catch(error => {
                throw error;
            });
    }, [setTemplateBlocks]);

    return (
        
        <Paper
            ref={setNodeRef}
            sx={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                padding: 1,
                backgroundColor: "lightblue",
                overflowY: "auto",
            }}
        >
            <Stack spacing={1} sx={{width: "100%"}}>
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
            </Stack>
            
        </Paper>
    )
}

export default TemplateBlockArea;
