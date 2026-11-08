import test from "node:test";
import assert from "node:assert/strict";
import {
    clearSelectedCalendarEvent,
    loadCalendarRange,
    resolveSelectedCalendarEvent,
} from "../src/feature/schesuler/utils/selection.ts";

test("visible range changes clear the selected calendar event", () => {
    const selections: Array<string | null> = [];

    clearSelectedCalendarEvent(selection => selections.push(selection));

    assert.deepEqual(selections, [null]);
});

test("an older range response preserves the latest events and selection", async () => {
    const latestRequest = { current: 0 };
    let selectedId: string | null = "october";
    let events: { clientId: string }[] = [];
    const setSelectedId = (id: string | null) => { selectedId = id; };
    const setEvents = (nextEvents: typeof events) => { events = nextEvents; };
    const november = Promise.withResolvers<typeof events>();
    const december = Promise.withResolvers<typeof events>();

    const older = loadCalendarRange(latestRequest, setSelectedId, () => november.promise, setEvents);
    assert.equal(selectedId, null);
    const latest = loadCalendarRange(latestRequest, setSelectedId, () => december.promise, setEvents);
    const decemberEvent = { clientId: "december" };
    december.resolve([decemberEvent]);
    await latest;
    setSelectedId(decemberEvent.clientId);

    november.resolve([{ clientId: "november" }]);
    await older;

    assert.deepEqual(events, [decemberEvent]);
    assert.equal(selectedId, decemberEvent.clientId);
    assert.equal(resolveSelectedCalendarEvent(events, selectedId), decemberEvent);
});

test("only the latest range failure is thrown", async () => {
    const latestRequest = { current: 0 };
    const olderResponse = Promise.withResolvers<never[]>();
    const latestResponse = Promise.withResolvers<never[]>();
    const setSelectedId = () => {};
    const setEvents = () => assert.fail("A failed request must not replace events");

    const older = loadCalendarRange(latestRequest, setSelectedId, () => olderResponse.promise, setEvents);
    const latest = loadCalendarRange(latestRequest, setSelectedId, () => latestResponse.promise, setEvents);
    const failure = new Error("Latest request failed");

    olderResponse.reject(new Error("Older request failed"));
    await older;
    const rejection = assert.rejects(latest, error => error === failure);
    latestResponse.reject(failure);
    await rejection;
});

test("the selected calendar event is resolved by its current client ID", () => {
    const events = [
        { clientId: "event-1", title: "first" },
        { clientId: "event-2", title: "second" },
    ];

    const selected = resolveSelectedCalendarEvent(events, "event-2");

    assert.equal(selected, events[1]);
});

test("no selection returns null without reporting an error", () => {
    let reported = false;

    const selected = resolveSelectedCalendarEvent([], null, () => {
        reported = true;
    });

    assert.equal(selected, null);
    assert.equal(reported, false);
});

test("a stale client ID is reported and resolved as no selection", () => {
    const refreshedEvents = [{ clientId: "new-client-id", id: 1 }];
    const reports: Array<{ message: string; context: unknown }> = [];

    const selected = resolveSelectedCalendarEvent(
        refreshedEvents,
        "old-client-id",
        (message, context) => reports.push({ message, context }),
    );

    assert.equal(selected, null);
    assert.deepEqual(reports, [{
        message: "Selected calendar event not found.",
        context: {
            eventClientId: "old-client-id",
            availableEventClientIds: ["new-client-id"],
        },
    }]);
});
