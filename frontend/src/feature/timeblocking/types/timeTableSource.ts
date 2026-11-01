import type { TimeBlockSource } from "./blockSourceTypes";

export type TimeTableSource = {
    id: number,
    date: Date,
    blocks: TimeBlockSource[],
}