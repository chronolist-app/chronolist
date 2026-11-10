import type CalendarEvent from "../../schesuler/entity/calendarEvent";

type ScheduleRange = Pick<CalendarEvent, "kind" | "startAt" | "endAt" | "startDate" | "endDate">;

const minutesInDay = 24 * 60;
const clockMinutes = (time: Date) => time.getHours() * 60 + time.getMinutes() + time.getSeconds() / 60;

export const getScheduleLayout = <Event extends ScheduleRange>(events: Event[], dayStart: Date) => {
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
    const visible = events.flatMap(event => {
        const allDay = event.kind === "ALL_DAY";
        const start = allDay ? event.startDate : event.startAt;
        const end = allDay ? event.endDate : event.endAt;
        if (!start || !end || !(start < end && start < dayEnd && end > dayStart)) return [];

        const startMinute = allDay || start <= dayStart ? 0 : clockMinutes(start);
        const endMinute = allDay || end >= dayEnd ? minutesInDay : clockMinutes(end);
        return [{ event, startMinute, endMinute }];
    });

    // 同時に始まる予定は長いものを背面に置き、全面に重なる場合は終日予定を背面に置く。
    visible.sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute
        || Number(b.event.kind === "ALL_DAY") - Number(a.event.kind === "ALL_DAY"));

    const laneEnds: number[] = [];
    const items = visible.map(item => {
        const availableLane = laneEnds.findIndex(end => end <= item.startMinute);
        const lane = availableLane === -1 ? laneEnds.length : availableLane;
        laneEnds[lane] = item.endMinute;
        return { ...item, lane };
    });

    return { items, laneCount: laneEnds.length };
};
