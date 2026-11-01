import { createContext } from "react";

const SelectedCalendarEventContext = createContext<{
    eventClientId: string | null,
    setEventClientId: (eventId: string | null) => void
}>({
    eventClientId: null,
    setEventClientId: () => { }
});

export default SelectedCalendarEventContext;