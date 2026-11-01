import { createContext } from "react";

import CalendarEvent from "../../entity/calendarEvent";


const CalendarEventsContext = createContext<{
    events: CalendarEvent[],
    setEvents: (events: CalendarEvent[] | ((events: CalendarEvent[]) => CalendarEvent[])) => void,
    updateEvent: (clientId: string, updatedEvent: CalendarEvent | ((updatedEvent: CalendarEvent) => CalendarEvent), callApi?: boolean) => void
}>({
    events: [],
    setEvents: () => { },
    updateEvent: () => { },
});

export default CalendarEventsContext;