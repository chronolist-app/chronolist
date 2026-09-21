import { useCallback, useContext, useState } from "react";
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
import registerEvent from "../api/register";
import CalendarEventsContext from "../components/contexts/calendar-events-context";
import SelectedCalendarEventContext from "../components/contexts/selected-event";


const useRegisterEventModal = () => {
    const [ values, setValues ] = useState(initialModalFormValues());
    const { setEvents } = useContext(CalendarEventsContext);
    const { setEventClientId: setSelectedEventId } = useContext(SelectedCalendarEventContext);

    const [ errorMessages, setErrorMessages ] = useState<{
        title: string | null;
        start: string | null;
        end: string | null;
    }>({
        title: null,
        start: null,
        end: null
    });

    const StartDateTimeField = () => {
        const props = {
            value: values.start,
            slotProps: {
                textField: {
                    helperText: errorMessages.start,
                },
            },
            error: errorMessages.start !== null,
            onChange: (newValue: Dayjs | null) => {
                setValues((v) => ({ ...v, start: newValue }));
                errorMessages.start = null;
            }
        }
        if (values.kind === "ALL_DAY") {
            return (
                <DatePicker
                    label="Start Date"
                    {...props}
                />
            );
        }
        return (
            <DateTimePicker 
                label="Start Date & Time"
                {...props}
            />
        )
    }
    const EndDateTimeField = () => {
        const props = {
            value: values.end,
            slotProps: {
                textField: {
                    helperText: errorMessages.end,
                },
            },
            error: errorMessages.end !== null,
            onChange: (newValue: Dayjs | null) => {
                setValues((v) => ({ ...v, end: newValue }));
                errorMessages.end = null;
            }
        }
        if (values.kind === "ALL_DAY") {
            return (
                <DatePicker
                    label="End Date"
                    {...props}
                />
            );
        }
        return (
            <DateTimePicker 
                label="End Date & Time"
                {...props}
            />
        )
    }

    const renderModalBody = () => (
        <Stack direction={"column"} alignItems={"center"} spacing={2}>
            <TextField
                label="Title"
                variant="outlined"
                value={values.title}
                onChange={(e) => {
                    setValues((v) => ({ ...v, title: e.target.value }));
                    setErrorMessages((v) => ({ ...v, title: null }));
                }}
                fullWidth
                helperText={errorMessages.title}
                error={errorMessages.title !== null}
            />
            <Stack direction={"column"} alignItems={"end"} spacing={1}>
                <Stack direction={"row"}>
                    <Typography>終日</Typography>
                    <CheckBox defaultChecked={values.kind === "ALL_DAY"} onChange={(checked) => setValues((v) => ({ ...v, kind: checked ? "ALL_DAY" : "DATED" }))} />
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

    const validate = () => {
        if (values.title === "") {
            setErrorMessages((v) => ({ ...v, title: "タイトルを入力してください" }));
            return false;
        }
        if (values.start === null) {
            setErrorMessages((v) => ({ ...v, start: "開始日時を入力してください" }));
            return false;
        }
        if (values.end === null) {
            setErrorMessages((v) => ({ ...v, end: "終了日時を入力してください" }));
            return false;
        }
        return true;
    }

    const handleSubmit = async () => {
        // テスト出力
        console.log("submit");
        console.log(values);

        if (!validate()) {
            return;
        }

        // API呼び出し
        const event = values2event(values);
        setEvents((events) => [...events, event]);
        setSelectedEventId(event.clientId);
        const id = await registerEvent(values2event(values));
        // TODO: CalendarEvent の id を変更可能にし, ID を設定する

        // テスト出力
        console.log(`id: ${id}`);

        handleCancel();
    }

    const handleCancel = () => {
        setValues(initialModalFormValues());
        setErrorMessages({
            title: null,
            start: null,
            end: null
        });
    }

    const { modal, toggleModalShow } = useModal({
        title: "新しい予定を作成",
        isOpen: false,
        acceptButtonlabel: "Create",
        onAccept: handleSubmit,
        cancelButtonlabel: "Cancel",
        onCancel: handleCancel,
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
    start: Dayjs | null;
    end: Dayjs | null;
    color: string;
    memo: string;
};

const initialModalFormValues = (): ModalFormValues => {
    return {
        title: "",
        kind: "ALL_DAY",
        start: dayjs(),
        end: dayjs(),
        color: "BLACK",
        memo: "",
    }
};

const values2event = (v: ModalFormValues): CalendarEvent => {
    if (!v.start || !v.end) throw new Error("Invalid date.");
    const e = new CalendarEvent(
        0,
        v.kind,
        v.start.toDate(),
        v.end.toDate(),
        v.title,
        v.color,
    );
    e.memo = v.memo;
    return e;
};

export default useRegisterEventModal;