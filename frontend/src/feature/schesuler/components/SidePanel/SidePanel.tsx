import { useContext, useEffect, useState, type FC } from "react"

import type CalendarEvent from "../../entity/calendarEvent"
import CalendarEventsContext from "../contexts/calendar-events-context";
import SelectedCalendarEventContext from "../contexts/selected-event";
import { Divider, Stack } from "@mui/material";
import Header from "./header";
import Time from "./Time";
import Color from "./Color";
import Memo from "./Memo";
import type { ScheduleKind } from "../../types/statics";
import deleteEvent from "../../api/delete";
import { addDays } from "@/utils/date";

// ローカル暦日を日数として比較し、夏時間による一日の長さの違いを除く。
const calendarDay = (date: Date): number =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;

/**
 * カレンダーイベントの詳細を表示・編集可能にするサイドパネル
 */
const SidePanel: FC = () => {
    
    const [ targetCalendarEvent, setTargetCalendarEvent ] = useState<CalendarEvent | null>(null);

    const {
        events,
        setEvents,
        updateEvent,
    } = useContext(CalendarEventsContext);

    const {
        eventClientId,
        setEventClientId,
    } = useContext(SelectedCalendarEventContext);

    // 選択中のカレンダーイベントを拾う
    useEffect(() => {
        if (!eventClientId) return;
        const event = events.find(e => e.clientId === eventClientId);
        if (!event) throw new Error("Event not found.");
        setTargetCalendarEvent(event);
    }, [eventClientId, setTargetCalendarEvent, events]);

    // 選択中のカレンダーイベントの更新を行い, カレンダーにも反映させる
    const changeCalendarEvent = (calendarEvent: CalendarEvent) => {
        setTargetCalendarEvent(calendarEvent);
        updateEvent(calendarEvent.clientId, calendarEvent, false);
    };
    
    const handleChangeTitle = (title: string) => {
        if (!targetCalendarEvent) return;
        targetCalendarEvent.title = title;
        changeCalendarEvent(targetCalendarEvent);
    };

    const handleDelete = () => {
        if (!targetCalendarEvent) return;
        if (!targetCalendarEvent.id) throw new Error("The event has no id.");
        // クライアント側の削除
        setEvents(events.filter(e => e.clientId !== targetCalendarEvent.clientId));
        setEventClientId(null);
        // サーバー側の削除
        deleteEvent(targetCalendarEvent.id);
    }

    const handleChangeStart = (start: Date) => {
        if (!targetCalendarEvent) return;
        const updatedEvent = targetCalendarEvent.clone();

        if (updatedEvent.kind === "ALL_DAY") {
            const oldStart = targetCalendarEvent.startDate;
            const oldEnd = targetCalendarEvent.endDate;
            if (!oldStart || !oldEnd) throw new Error("The event has no date range.");

            updatedEvent.startDate = new Date(start.getTime());
            if (calendarDay(start) > calendarDay(oldEnd)) {
                const durationDays = calendarDay(oldEnd) - calendarDay(oldStart);
                updatedEvent.endDate = addDays(start, durationDays);
            }
        } else {
            const oldStart = targetCalendarEvent.startAt;
            const oldEnd = targetCalendarEvent.endAt;
            if (!oldStart || !oldEnd) throw new Error("The event has no datetime range.");

            updatedEvent.startAt = new Date(start.getTime());
            if (start.getTime() > oldEnd.getTime()) {
                const duration = oldEnd.getTime() - oldStart.getTime();
                updatedEvent.endAt = new Date(start.getTime() + duration);
            }
        }

        // 開始・終了を確定してから、一度の更新で画面とサーバーに反映する。
        changeCalendarEvent(updatedEvent);
    }

    const handleChangeEnd = (end: Date) => {
        if (!targetCalendarEvent) return;
        if (targetCalendarEvent.kind === "ALL_DAY") targetCalendarEvent.endDate = end;
        else targetCalendarEvent.endAt = end;
        changeCalendarEvent(targetCalendarEvent);
    }

    const handleChangeKind = (kind: ScheduleKind) => {
        if (!targetCalendarEvent) return;
        targetCalendarEvent.kind = kind;
        changeCalendarEvent(targetCalendarEvent);
    }

    const handleChangeColor = (color: string) => {
        if (!targetCalendarEvent) return;
        targetCalendarEvent.color = color;
        changeCalendarEvent(targetCalendarEvent);
    };

    const handleChangeMemo = (memo: string) => {
        if (!targetCalendarEvent) return;
        targetCalendarEvent.memo = memo;
        changeCalendarEvent(targetCalendarEvent);
    };

    const dividerSx = {
        borderColor: "grey.500",
        borderBottomWidth: 2,
    }

    return (
        <>
            <Stack
                direction={"column"}
                divider={<Divider orientation="horizontal" flexItem sx={dividerSx} />}
                spacing={3}
            >
                <Header
                    title={targetCalendarEvent?.title || ""}
                    setTitle={handleChangeTitle}
                    onDelete={handleDelete}
                />
                <Time
                    kind={targetCalendarEvent?.kind || "DATED"}
                    start={targetCalendarEvent?.startAt || targetCalendarEvent?.startDate || new Date()}
                    end={targetCalendarEvent?.endAt || targetCalendarEvent?.endDate || new Date()}
                    onChangeStart={handleChangeStart}
                    onChangeEnd={handleChangeEnd}
                    onChangeKind={handleChangeKind}
                />
                <Color
                    color={targetCalendarEvent?.color || "RED"}
                    onChange={handleChangeColor}
                />
                <Memo
                    memo={targetCalendarEvent?.memo || ""}
                    onChange={handleChangeMemo}
                />
            </Stack>
        </>
    )
};

export default SidePanel;
