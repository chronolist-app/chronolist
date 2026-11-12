import { isValidBlockWidth } from "./blockValidation.ts";
import type { TimeBlockSource } from "../types/blockSourceTypes";

type DropSource = Pick<TimeBlockSource, "width" | "status" | "timeTableId" | "fromTemplateBlockSource">;

/** 同一表の移動だけ日内へ補正し、その他の配置は範囲外を拒否する。 */
export const getDropStartMinutes = (
    offsetTop: number,
    slotHeight: number,
    slotMinutes: number,
    source: DropSource,
    timeTableId: number,
): number | null => {
    if (!isValidBlockWidth(source.width) || !Number.isFinite(offsetTop) || slotHeight <= 0 || slotMinutes <= 0) return null;
    const minutes = Math.floor(offsetTop / slotHeight) * slotMinutes;
    const isMoveWithinTable = source.status === "PLACED" && source.timeTableId === timeTableId &&
        !source.fromTemplateBlockSource;
    const lastSlot = Math.floor((1440 - source.width) / slotMinutes) * slotMinutes;
    const startMinutes = isMoveWithinTable ? Math.min(lastSlot, Math.max(0, minutes)) : minutes;
    return startMinutes >= 0 && startMinutes <= lastSlot ? startMinutes : null;
};
