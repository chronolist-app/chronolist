import test from "node:test";
import assert from "node:assert/strict";
import {
    clearSelectedCalendarEvent,
    resolveSelectedCalendarEvent,
} from "../src/feature/schesuler/utils/selection.ts";

test("visible range changes clear the selected calendar event", () => {
    const selections: Array<string | null> = [];

    clearSelectedCalendarEvent(selection => selections.push(selection));

    assert.deepEqual(selections, [null]);
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
