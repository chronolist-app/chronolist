import { Paper, Typography } from "@mui/material"
import { useContext, type ComponentPropsWithoutRef, type FC } from "react";

import type { TimeBlockSource } from "../types/blockSourceTypes";
import TimeTableConfigure from "../contexts/TimeTableConfigure";


type TimeBlockViewProps = {
    source: TimeBlockSource,
    ref?: React.Ref<HTMLDivElement>
} & ComponentPropsWithoutRef<typeof Paper>;

const TimeBlockView: FC<TimeBlockViewProps> = ({ source, ref, sx, ...rest }) => {
    
    const {
        slotHeight,
        slotMinutes,
    } = useContext(TimeTableConfigure);

    const height = Math.floor(source.width * (slotHeight / slotMinutes));
    
    return (
        <Paper
            ref={ref}
            {...rest}
            sx={{
                bgcolor: source.color,
                color: "white",
                display: "inline-flex",
                overflowWrap: "anywhere",
                padding: "5px",
                zIndex: 1,
                height,
                width: "100%",
                ...sx,
            }}
        >
            <Typography variant="h6">{source.title}</Typography>
        </Paper>
    );
};

export default TimeBlockView;
