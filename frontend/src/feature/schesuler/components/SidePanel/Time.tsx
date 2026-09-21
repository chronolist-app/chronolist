import type { FC } from "react";
import { Stack, Typography } from "@mui/material";
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

import CheckBox from "@/components/checkbox";
import EditableDateText from "@/components/EditableDateText";
import EditableTimeText from "@/components/EditableTimeText";
import type { ScheduleKind } from "../../types/statics"
import { Time as MyTime } from "@/utils/time";


type TimeProps = {
    kind: ScheduleKind,
    start: Date,
    end: Date,
    onChangeStart: (start: Date) => void,
    onChangeEnd: (end: Date) => void,
    onChangeKind: (kind: ScheduleKind) => void
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
    onChangeStart,
    onChangeEnd,
    onChangeKind
}) => {

    return (
        <>
            <Stack direction={"column"} alignItems={"center"} spacing={2}>
                <AllDayCheckBox kind={kind} onChangeKind={onChangeKind} />
                <DateTimeBox kind={kind} time={start} onChange={onChangeStart} />
                <ArrowDownwardIcon />
                <DateTimeBox kind={kind} time={end} onChange={onChangeEnd} />
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