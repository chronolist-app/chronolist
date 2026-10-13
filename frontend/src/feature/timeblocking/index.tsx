import { DndContext, MouseSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import { Box, Stack } from "@mui/material";
import { useState } from "react";

import TimeTable from "./components/TimeTable";
import TimeTableConfigure from "./contexts/TimeTableConfigure";
import { Time } from "@/utils/time";
import BlockAvailable from "./components/BlockAvailable";
import BlocksArea from "./components/BlocksArea";
import TemplateBlockArea from "./components/TemplateBlockArea";
import SelectedTimeBlockId from "./contexts/SelectedTimeBlockClientId";
import SelectedTemplateBlockClientId from "./contexts/SelectedTemplateBlockClientId";
import TimeBlockDetailPanel from "./components/TimeBlockDetailPanel";
import TemplateBlockDetailPanel from "./components/TemplateBlockDetailPanel";


const TimeBlockingPage = () => {

    const [ timeTableId, setTimeTableId ] = useState(-1);

    const tableConfig = {
        timeTableId,
        gridSize: 1,
        tableHeight: 2000,
        tableWidth: "100%",
        startTime: new Time(0, 0),
        slotMinutes: 30,
        slotHeight: 2000 * 30 / (24 * 60),
        setTimeTableId,
    };

    const [ selectedTimeBlockId, setSelectedTimeBlockId ] = useState<string | null>(null);
    const [ selectedTemplateBlockClientId, setSelectedTemplateBlockClientId ] = useState<string | null>(null);

    const mouseSensor = useSensor(MouseSensor, {activationConstraint: {distance: 10}});
    const sensors = useSensors(mouseSensor);

    return (
        
        <DndContext
            collisionDetection={pointerWithin}
            onDragEnd={(event) => {console.log(event)}}
            sensors={sensors}
        >
            <TimeTableConfigure value={tableConfig}>
                <SelectedTimeBlockId value={{ selectedTimeBlockId, setSelectedTimeBlockClientId: setSelectedTimeBlockId }}>
                    <SelectedTemplateBlockClientId value={{ selectedTemplateBlockClientId, setSelectedTemplateBlockClientId }}>
                            <BlockAvailable>
                            <Stack direction={"row"} sx={{ width: "100%", height: "100%", minHeight: 0, flexShrink: 0 }}>
                                <Box sx={{ height: "100%", width: "50%", minHeight: 0, minWidth: 0 }}><TimeTable /></Box>
                                <Stack
                                    sx={{
                                        height: "100%",
                                        width: "50%",
                                        minHeight: 0,
                                        minWidth: 0,
                                        border: "1px solid red",
                                    }}
                                >
                                    <BlocksArea />
                                    <TemplateBlockArea />
                                </Stack>
                            </Stack>
                            <TimeBlockDetailPanel />
                            <TemplateBlockDetailPanel />
                        </BlockAvailable>
                    </SelectedTemplateBlockClientId>
                </SelectedTimeBlockId>
            </TimeTableConfigure>
        </DndContext>
    )
}

export default TimeBlockingPage;
