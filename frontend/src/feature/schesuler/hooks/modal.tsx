import { useCallback, useState } from "react";
import dayjs, { Dayjs } from 'dayjs';
import type { ScheduleKind } from "../types/statics";
import { Stack, TextField, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import PullDown from "@/components/pulldown";
import useModal from "@/hooks/use-modal";
import CalendarEvent from "../entity/calendarEvent";
import CheckBox from "@/components/checkbox";


const useRegisterEventModal = () => {
    const [ values, setValues ] = useState(initialModalFormValues());

    const StartDateTimeField = () => {
        if (values.kind === "ALL_DAY") {
            return (
                <DatePicker
                    label="Start Date"
                    value={values.startDate}
                    onChange={(newValue) => setValues((v) => ({ ...v, startDate: newValue }))}
                />
            );
        }
        return (
            <DateTimePicker 
                label="Start Date & Time"
                value={values.startAt}
                onChange={(newValue) => setValues((v) => ({ ...v, startAt: newValue }))}
            />
        )
    }
    const EndDateTimeField = () => {
        if (values.kind === "ALL_DAY") {
            return (
                <DatePicker
                    label="End Date"
                    value={values.endDate}
                    onChange={(newValue) => setValues((v) => ({ ...v, endDate: newValue }))}
                />
            );
        }
        return (
            <DateTimePicker 
                label="End Date & Time"
                value={values.endAt}
                onChange={(newValue) => setValues((v) => ({ ...v, endAt: newValue }))}
            />
        )
    }
    const onChangeKind = useCallback((kind: ScheduleKind) => setValues(
        (v) => ({
            ...v,
            kind,
            startAt: kind === "ALL_DAY" ? null : v.startDate,
            endAt: kind === "ALL_DAY" ? null : v.endDate,
            startDate: kind === "ALL_DAY" ? v.startAt : null,
            endDate: kind === "ALL_DAY" ? v.endAt : null
        })
    ), [setValues]);

    const renderModalBody = () => (
        <Stack direction={"column"} alignItems={"center"} spacing={2}>
            <TextField
                label="Title"
                variant="outlined"
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                fullWidth
            />
            <Stack direction={"column"} alignItems={"end"} spacing={1}>
                <Stack direction={"row"}>
                    <Typography>終日</Typography>
                    <CheckBox defaultChecked={values.kind === "ALL_DAY"} onChange={(checked) => onChangeKind(checked ? "ALL_DAY" : "DATED")} />
                </Stack>
                <Stack direction={"column"} spacing={1} alignItems={"center"}>
                    <StartDateTimeField />
                    <ArrowDownwardIcon />
                    <EndDateTimeField />
                </Stack>
            </Stack>
            <PullDown
                items={["BLACK", "RED", "ORANGE", "YELLOW", "GREEN", "BLUE", "PURPLE", "PINK"]}
                onChange={(color) => setValues((v) => ({ ...v, color }))}
                defaultValue={values.color}
            />
            <TextField
                label="Memo"
                variant="outlined"
                value={values.memo}
                multiline
                rows={3}
                onChange={(e) => setValues((v) => ({ ...v, memo: e.target.value }))}
                fullWidth
            />
        </Stack>
    );

    const handleSubmit = () => {
        // テスト出力
        console.log("submit");
        console.log(values);

        // TODO: 予定登録APIを呼び出す
    }

    const handleCancel = () => {
        setValues(initialModalFormValues());
    }

    const handleClose = () => {
        setValues(initialModalFormValues());
    }

    const { modal, toggleModalShow } = useModal({
        title: "新しい予定を作成",
        isOpen: false,
        acceptButtonlabel: "Create",
        onAccept: handleSubmit,
        cancelButtonlabel: "Cancel",
        onCancel: handleCancel,
        onClose: handleClose,
        children: renderModalBody(),
    });

    const setDates = useCallback((start: Date, end: Date) => setValues((v) => ({
        ...v,
        startDate: dayjs(start),
        endDate: dayjs(end),
    })), [setValues]);

    return { modal, toggleModalShow, setDates };
}

interface ModalFormValues {
    title: string;
    kind: ScheduleKind;
    startAt: Dayjs | null;
    endAt: Dayjs | null;
    startDate: Dayjs | null;
    endDate: Dayjs | null;
    color: string;
    memo: string;
};

const initialModalFormValues = (): ModalFormValues => {
    return {
        title: "",
        kind: "ALL_DAY",
        startAt: null,
        endAt: null,
        startDate: dayjs(),
        endDate: dayjs(),
        color: "BLACK",
        memo: "",
    }
};

const values2event = (v: ModalFormValues): CalendarEvent => {
    const e = new CalendarEvent(
        0,
        v.kind,
        v.startAt?.toDate() || v.startDate?.toDate() || new Date(),
        v.endAt?.toDate() || v.endDate?.toDate() || new Date(),
        v.title,
        v.color,
    );
    e.memo = v.memo;
    return e;
};

export default useRegisterEventModal;