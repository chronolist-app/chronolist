import { useState } from "react"

import type CalendarEvent from "./entity/calendarEvent";
import CalendarEventsContext from "./components/contexts/calendar-events-context"
import SelectedCalendarEventContext from "./components/contexts/selected-event"
import Calendar from "./components/calendar";

import { Box, Button, Stack } from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import SidePanel from "./components/SidePanel/SidePanel";
import useRegisterEventModal from "./hooks/modal";


const SchedulerPage = () => {

    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const updateEvent = (clientId: string, updatedEvent: CalendarEvent | ((updatedEvent: CalendarEvent) => CalendarEvent), callApi?: boolean) => {
        const oldEvent = events.find(e => e.clientId === clientId);
        if (!oldEvent) throw new Error("Event not found.");
        const newEvent = typeof updatedEvent === "function" ? updatedEvent(oldEvent) : updatedEvent;
        setEvents(events.map(event => event.clientId === newEvent.clientId ? newEvent : event));
        // if (callApi) updateEventApi(updatedEvent);
    };

    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const DynamicCalendar = (
        <>
            <Box sx={{flex: (selectedEventId ? 3 : 1)}}>
                <Calendar />
            </Box>
        </>
    );
    const DynamicSidePanel = selectedEventId && (
        <>
            <Box sx={{flex: 1}}>
                <SidePanel />
            </Box>
        </>
    )
    const { modal, toggleModalShow } = useRegisterEventModal();
    return (
        <>
            <CalendarEventsContext value={{events, setEvents, updateEvent}} >
                <SelectedCalendarEventContext value={{eventClientId: selectedEventId, setEventClientId: setSelectedEventId}} >
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <Stack sx={{height: "100vh", width: "100vw", border: "1px solid red", alignItems: "stretch"}} direction={"row"}>
                            {modal}
                            <Button onClick={() => toggleModalShow()}>Open Modal</Button>
                            {DynamicCalendar}
                            {DynamicSidePanel}
                        </Stack>
                    </LocalizationProvider>
                </SelectedCalendarEventContext>
            </CalendarEventsContext>
        </>
    )
}

export default SchedulerPage;