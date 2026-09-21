import type { FC } from "react";
import { Stack, Typography } from "@mui/material";
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

import CheckBox from "@/components/checkbox";
import EditableDateText from "@/components/EditableDateText";
import EditableTimeText from "@/components/EditableTimeText";
import type { ScheduleKind } from "../../types/statics"
import { Time as MyTime } from "@/utils/time";
import CalendarEvent from "../../entity/calendarEvent";


type TimeProps = {
    kind: ScheduleKind,
    start: Date,
    end: Date,
    setCalendarEvent: ( calendarEvent: (CalendarEvent | null) | ((calendarEvent: (CalendarEvent | null)) => CalendarEvent | null)) => void,
}

type AllDayCheckBoxProps = {
    kind: ScheduleKind,
    onChangeKind: (kind: ScheduleKind) => void,
}

type DateTimeBox = {
    kind: ScheduleKind,
    time: Date,
    onChange: (time: Date) => void,
}

const Time: FC<TimeProps> = ({
    kind,
    start,
    end,
    setCalendarEvent
}) => {
    const handleChangeStartTime = (time: Date) => {
        setCalendarEvent((c) => {
            if (!c) return null;
            const clone = c.clone();
            if (kind === "ALL_DAY") clone.startDate = time;
            else clone.startAt = time;
            return clone;
        })
    };
    const handleChangeEndTime = (time: Date) => {
        setCalendarEvent((c) => {
            if (!c) return null;
            const clone = c.clone();
            if (kind === "ALL_DAY") clone.endDate = time;
            else clone.endAt = time;
            return clone;
        })
    }
    const handleChangeKind = (kind: ScheduleKind) => {
        setCalendarEvent ((c) => {
            if (!c) return null;
            const clone = c.clone();
            clone.kind = kind;
            return clone;
        });
    }
    return (
        <>
            <Stack direction={"column"} alignItems={"center"} spacing={2}>
                <AllDayCheckBox kind={kind} onChangeKind={handleChangeKind} />
                <DateTimeBox kind={kind} time={start} onChange={handleChangeStartTime} />
                <ArrowDownwardIcon />
                <DateTimeBox kind={kind} time={end} onChange={handleChangeEndTime} />
            </Stack>
        </>
    )
};

const AllDayCheckBox: FC<AllDayCheckBoxProps> = ({kind, onChangeKind}) => {
    return (
        <>
            <Stack direction={"row"} sx={{justifyContent: "flex-end", width: "100%"}}>
                <Typography>終日</Typography>
                <CheckBox defaultChecked={kind === "ALL_DAY"} onChange={(checked) => onChangeKind(checked ? "ALL_DAY" : "DATED")} />
            </Stack>
        </>
    );
}

const DateTimeBox: FC<DateTimeBox> = ({kind, time, onChange}) => {
    const isAllDay = kind === "ALL_DAY";

    if (isAllDay) return <EditableDateText value={time} onChange={onChange} />;

    const onChangeDate = (date: Date) => {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
        onChange(d);
    }
    const onChangeTime = (newTime: MyTime) => {
        const d = new Date(time.getFullYear(), time.getMonth(), time.getDate(), newTime.hour, newTime.minute);
        onChange(d);
    }

    return (
        <Stack direction={"row"} spacing={2}>
            <EditableDateText value={time} onChange={onChangeDate} />
            <EditableTimeText value={new MyTime(time)} onChange={(time) => onChangeTime(time)} />
        </Stack>
    );
}

export default Time;