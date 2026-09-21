import FullCalendar from "@fullcalendar/react";
import type { EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useContext } from "react";

import CalendarEventsContext from "./contexts/calendar-events-context";
import SelectedCalendarEventContext from "./contexts/selected-event";
import { getCalendarEvents } from "../api/get";
import { prevDate } from "@/utils/date";
import { formattedTime } from "@/utils/time";
import { Box } from "@mui/material";

const Calendar = () => {
    const { events, setEvents } = useContext(CalendarEventsContext);
    const { setEventClientId: setSelectedEventId } = useContext(SelectedCalendarEventContext);

    // 初期化時や月変更時に呼び出される関数
    const handleDatesSet = useCallback(async (arg: DatesSetArg) => {
        const start = arg.start;
        const end = prevDate(arg.end);
        const events = await getCalendarEvents(start, end);
        setEvents(events);

        // テスト出力
        console.log("handleDatesSet");
        console.log(start.toISOString(), "|", end.toISOString());
        console.log("events: ", events);
    }, [setEvents]);

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
        return (
            <>
                <label className="p-1">
                    {arg.event.start && formattedTime(arg.event.start)}
                </label>
                <label className="p-1">{arg.event.title}</label>
            </>
        )
    }, []);

    return (
        <Box sx={{height: "100%", width: "100%"}}>
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
                initialView="dayGridMonth"
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
                height={"100%"}
            />
        </Box>
    );
}

export default Calendar;