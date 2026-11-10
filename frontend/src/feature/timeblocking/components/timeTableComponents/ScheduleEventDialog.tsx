import { useId } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import type CalendarEvent from "@/feature/schesuler/entity/calendarEvent";
import { prevDate, toDateString, toDateTimeString } from "@/utils/date";

const formatDateTime = (value: Date | undefined) => value && toDateTimeString(value).replace("T", " ");

const ScheduleEventDialog = ({ date, event, onClose }: { date: string; event: CalendarEvent; onClose: () => void }) => {
    const titleId = useId();
    const allDay = event.kind === "ALL_DAY";
    const fields = [
        ["開始", allDay && event.startDate ? toDateString(event.startDate) : formatDateTime(event.startAt)],
        ["終了", allDay && event.endDate ? toDateString(prevDate(event.endDate)) : formatDateTime(event.endAt)],
        ["カラー", event.color],
        ["メモ", event.memo],
    ];

    return (
        <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
            <DialogTitle id={titleId} sx={{ overflowWrap: "anywhere" }}>{event.title}</DialogTitle>
            <DialogContent>
                {allDay && <Typography>終日</Typography>}
                <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", gap: 1, m: 0 }}>
                    {fields.filter(([, value]) => value).map(([label, value]) => (
                        <Box key={label} sx={{ display: "contents" }}>
                            <Typography component="dt" fontWeight="medium">{label}</Typography>
                            <Typography component="dd" sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                                {value}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                {event.id !== undefined && (
                    <Button component={Link} to="/scheduler" state={{ date, eventId: event.id }}>
                        スケジューラで編集
                    </Button>
                )}
                <Button onClick={onClose}>閉じる</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ScheduleEventDialog;
