import { useContext, useEffect, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";

import { getCalendarEvents } from "@/feature/schesuler/api/get";
import type CalendarEvent from "@/feature/schesuler/entity/calendarEvent";
import { fromDateString } from "@/utils/date";
import TimeTableConfigure from "../../contexts/TimeTableConfigure";
import { getScheduleLayout } from "../../utils/scheduleLayout";
import ScheduleEventDialog from "./ScheduleEventDialog";

type ScheduleState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "success"; events: CalendarEvent[] };

const ScheduleEvents = ({ date, events }: { date: string; events: CalendarEvent[] }) => {
    const { slotHeight, slotMinutes } = useContext(TimeTableConfigure);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const { items, laneCount } = getScheduleLayout(events, fromDateString(date));
    const pixelsPerMinute = slotHeight / slotMinutes;

    return (
        <>
            {items.map(({ event, startMinute, endMinute, lane }) => (
                <Box
                    key={event.clientId}
                    component="button"
                    type="button"
                    aria-haspopup="dialog"
                    title={event.title}
                    onClick={() => setSelectedEvent(event)}
                    style={{
                        top: startMinute * pixelsPerMinute,
                        height: (endMinute - startMinute) * pixelsPerMinute,
                        left: lane === 0 ? 0 : `min(${lane * 8}px, ${lane * 65 / (laneCount - 1)}%)`,
                        zIndex: lane + 1,
                        boxShadow: `inset 2px 0 ${event.color}`,
                        backgroundColor: `color-mix(in srgb, color-mix(in srgb, ${event.color} 15%, white) 80%, transparent)`,
                    }}
                    sx={{
                        position: "absolute",
                        right: 0,
                        display: "flex",
                        p: 0,
                        border: 0,
                        borderRadius: "2px",
                        bgcolor: "background.paper",
                        color: "text.primary",
                        overflow: "hidden",
                        textAlign: "left",
                        cursor: "pointer",
                        "&:focus-visible": { outline: "2px solid currentColor", outlineOffset: -2 },
                    }}
                >
                    <Typography component="span" variant="body2" sx={{ px: 0.5, overflowWrap: "anywhere" }}>
                        {event.title}
                    </Typography>
                </Box>
            ))}
            {selectedEvent && (
                <ScheduleEventDialog date={date} event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            )}
        </>
    );
};

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
                isolation: "isolate",
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
            {schedule.status === "success" && <ScheduleEvents date={date} events={schedule.events} />}
        </Box>
    );
};

export default ScheduleArea;
