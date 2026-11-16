import { getBlockDisplayWidth } from "./blockValidation.ts";
import type { Time } from "@/utils/time";
import type { TimeBlockSource } from "../types/blockSourceTypes";

type PositionedBlock = TimeBlockSource & { startAt: Time };
type BlockLayout = { block: PositionedBlock; columnIndex: number; columnCount: number };

export const isPositionedBlock = (block: TimeBlockSource): block is PositionedBlock => {
    if (block.status !== "PLACED" || !block.startAt) return false;
    const minutes = block.startAt.toMinutes();
    return minutes >= 0 && minutes < 24 * 60;
};

/** 衝突でつながるグループごとに、最大同時重複数の列へ配置する。 */
export const getTimeBlockLayout = (blocks: TimeBlockSource[]): BlockLayout[] => {
    const sorted = blocks.filter(isPositionedBlock)
        .sort((a, b) => a.startAt.toMinutes() - b.startAt.toMinutes());
    const layout: BlockLayout[] = [];
    let group: { block: PositionedBlock; columnIndex: number }[] = [];
    let groupEnd = -Infinity;
    let columnEnds: number[] = [];

    const finishGroup = () => {
        for (const item of group) {
            layout.push({ ...item, columnCount: columnEnds.length });
        }
        group = [];
        columnEnds = [];
    };

    for (const block of sorted) {
        const start = block.startAt.toMinutes();
        const end = start + getBlockDisplayWidth(block.width);
        // 直前のブロックでなくグループ全体の終了と比較し、入れ子も同じグループに保つ。
        if (start >= groupEnd) finishGroup();
        groupEnd = group.length === 0 ? end : Math.max(groupEnd, end);

        // 終了と開始が一致する列も再利用できる。空き列がなければ列を増やす。
        const availableColumn = columnEnds.findIndex(columnEnd => columnEnd <= start);
        const columnIndex = availableColumn === -1 ? columnEnds.length : availableColumn;
        columnEnds[columnIndex] = end;
        group.push({ block, columnIndex });
    }
    finishGroup();
    return layout;
};
