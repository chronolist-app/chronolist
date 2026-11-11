import type { TimeBlockSource } from "../types/blockSourceTypes";

type DropSource = Pick<TimeBlockSource, "status" | "timeTableId" | "fromTemplateBlockSource">;

export const getDropStartMinutes = (
    offsetTop: number,
    slotHeight: number,
    slotMinutes: number,
    source: DropSource,
    timeTableId: number,
): number | null => {
    const minutes = Math.floor(offsetTop / slotHeight) * slotMinutes;
    const isMoveWithinTable = source.status === "PLACED" && source.timeTableId === timeTableId &&
        !source.fromTemplateBlockSource;
    const startMinutes = isMoveWithinTable ? Math.max(0, minutes) : minutes;
    return startMinutes >= 0 && startMinutes < 24 * 60 ? startMinutes : null;
};
