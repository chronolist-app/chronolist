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

/**
 * カレンダーイベントの詳細を表示・編集可能にするサイドパネル
 */
type SidePanelProps = {}

const SidePanel: FC<SidePanelProps> = () => {
    
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
    }, [eventClientId, setTargetCalendarEvent]);

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
        // クライアント側の削除
        setEvents(events.filter(e => e.clientId !== targetCalendarEvent.clientId));
        setEventClientId(null);
        // サーバー側の削除
        // deleteApi(calendarEvent.id);
    }

    const handleChangeStart = (start: Date) => {
        if (!targetCalendarEvent) return;
        if (targetCalendarEvent.kind === "ALL_DAY") targetCalendarEvent.startDate = start;
        else targetCalendarEvent.startAt = start;
        changeCalendarEvent(targetCalendarEvent);
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