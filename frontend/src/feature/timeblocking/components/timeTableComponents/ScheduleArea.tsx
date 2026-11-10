import { useContext, useEffect, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";

import { getCalendarEvents } from "@/feature/schesuler/api/get";
import type CalendarEvent from "@/feature/schesuler/entity/calendarEvent";
import TimeTableConfigure from "../../contexts/TimeTableConfigure";

type ScheduleState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "success"; events: CalendarEvent[] };

const ScheduleArea = ({ date }: { date: string }) => {
    const { gridSize } = useContext(TimeTableConfigure);
    const [schedule, setSchedule] = useState<ScheduleState>({ status: "loading" });

    useEffect(() => {
        let ignore = false;

        getCalendarEvents(date, date).then(events => {
            if (!ignore) setSchedule({ status: "success", events });
        }).catch(() => {
            if (!ignore) setSchedule({ status: "error" });
        });

        return () => { ignore = true; };
    }, [date]);

    return (
        <Box
            component="section"
            aria-label="予定"
            aria-busy={schedule.status === "loading"}
            sx={{
                gridArea: "schedule",
                position: "relative",
                boxShadow: `inset ${gridSize}px 0 currentColor, inset -${gridSize}px 0 currentColor`,
            }}
        >
            {schedule.status === "loading" && (
                <Typography role="status" variant="body2" sx={{ px: 0.5, overflowWrap: "anywhere" }}>
                    予定を読み込み中…
                </Typography>
            )}
            {schedule.status === "error" && (
                <Alert severity="error" icon={false} sx={{ px: 0.5, overflowWrap: "anywhere" }}>
                    予定を読み込めませんでした。
                </Alert>
            )}
        </Box>
    );
};

export default ScheduleArea;
