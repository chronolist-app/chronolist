type CalendarEventReference = {
    clientId: string;
};

type MissingSelectionContext = {
    eventClientId: string;
    availableEventClientIds: string[];
};

type SelectionErrorReporter = (
    message: string,
    context: MissingSelectionContext,
) => void;

const reportMissingSelection: SelectionErrorReporter = (message, context) => {
    console.error(message, context);
};

export const clearSelectedCalendarEvent = (
    setEventClientId: (eventClientId: string | null) => void,
) => {
    setEventClientId(null);
};

export const resolveSelectedCalendarEvent = <T extends CalendarEventReference>(
    events: T[],
    eventClientId: string | null,
    reportError: SelectionErrorReporter = reportMissingSelection,
): T | null => {
    if (!eventClientId) return null;

    const event = events.find(candidate => candidate.clientId === eventClientId);
    if (event) return event;

    reportError("Selected calendar event not found.", {
        eventClientId,
        availableEventClientIds: events.map(candidate => candidate.clientId),
    });
    return null;
};
