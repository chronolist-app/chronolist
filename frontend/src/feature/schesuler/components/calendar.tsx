import FullCalendar from "@fullcalendar/react";
import type { EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useContext, useRef } from "react";
import { useLocation } from "react-router-dom";

import CalendarEventsContext from "./contexts/calendar-events-context";
import SelectedCalendarEventContext from "./contexts/selected-event";
import { getCalendarEvents } from "../api/get";
import { fromDateString, prevDate } from "@/utils/date";
import { formattedTime } from "@/utils/time";
import { Box } from "@mui/material";
import useRegisterEventModal from "../hooks/modal";
import { loadCalendarRange } from "../utils/selection";

const Calendar = () => {
    const { events, setEvents } = useContext(CalendarEventsContext);
    const { setEventClientId: setSelectedEventId } = useContext(SelectedCalendarEventContext);
    const { modal, toggleModalShow, setDates } = useRegisterEventModal();
    const latestRangeRequest = useRef(0);
    const { state } = useLocation();
    const initialDate = typeof state?.date === "string" ? state.date : undefined;
    const pendingEventId = useRef<number | undefined>(typeof state?.eventId === "number" ? state.eventId : undefined);

    // 初期化時や月変更時に呼び出される関数
    const handleDatesSet = useCallback((arg: DatesSetArg) => {
        if (pendingEventId.current !== undefined && initialDate) {
            const targetDate = fromDateString(initialDate);
            if (targetDate < arg.view.currentStart || targetDate >= arg.view.currentEnd) {
                pendingEventId.current = undefined;
            }
        }
        return loadCalendarRange(
            latestRangeRequest,
            setSelectedEventId,
            () => getCalendarEvents(arg.start, prevDate(arg.end)),
            loadedEvents => {
                setEvents(loadedEvents);
                const eventId = pendingEventId.current;
                pendingEventId.current = undefined;
                if (eventId !== undefined) {
                    const target = loadedEvents.find(event => event.id === eventId);
                    if (target) setSelectedEventId(target.clientId);
                }
            },
        );
    }, [initialDate, setEvents, setSelectedEventId]);

    // イベントラベル選択時に呼び出される関数
    const handleEventClick = useCallback((arg: EventClickArg) => {
        const clickedEventClientId = arg.event.id;
        const targetEvent = events.find(e => e.clientId === clickedEventClientId);
        if (!targetEvent) {
            console.log(`Event not found: ${clickedEventClientId}`);
            console.log(events);
            throw new Error("Event not found.");
        };

        setSelectedEventId(clickedEventClientId || null);

        // テスト出力
        console.log("handleEventClick");
        console.log(targetEvent);

    },  [events, setSelectedEventId]);

    // イベントラベル表示時に呼び出される関数
    const handleEventContent = useCallback((arg: EventContentArg) => {
        const labelStyle = arg.event.allDay ? undefined : { color: arg.textColor };
        return (
            <>
                <label className="p-1" style={labelStyle}>
                    {arg.event.start && formattedTime(arg.event.start)}
                </label>
                <label className="p-1" style={labelStyle}>{arg.event.title}</label>
            </>
        )
    }, []);

    // ダブルクリック時に予定作成モーダルを表示
    const handleDateDoubleClick = useCallback((info: DateClickArg) => {
        setDates(info.date, info.date);
        toggleModalShow(true);
    }, [setDates, toggleModalShow]);

    // イベントがない空白部をクリックされたときに呼び出される関数
    const handleDateClick = useCallback((info: DateClickArg) => {
        if (info.jsEvent.detail === 2) handleDateDoubleClick(info);
    }, [handleDateDoubleClick]);

    return (
        <Box sx={{height: "100%", width: "100%"}}>
            {modal}
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
                initialView="dayGridMonth"
                initialDate={initialDate}
                headerToolbar={{
                    start: "title prev,next today",
                    center: "",
                    end: "",
                }}
                locale={"ja"}
                businessHours={true}
                dayMaxEvents={true}
                events={events.map(e => e.toEventLabel())}
                datesSet={handleDatesSet}
                eventClick={handleEventClick}
                eventContent={handleEventContent}
                dateClick={handleDateClick}
                height={"100%"}
            />
        </Box>
    );
}

export default Calendar;
