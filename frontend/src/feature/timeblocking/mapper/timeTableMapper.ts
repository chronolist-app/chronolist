import type { TimeTableApi } from "../types/api";
import type { TimeTableSource } from "../types/timeTableSource";
import { toTimeBlockSource } from "./blockMapper";
import { fromDateString } from "@/utils/date";


/**
 * `TimeTableApi` を `TimeTableSource` に変換するマッパー関数.
 * 
 * @param api APIオブジェクト
 * @return 変換されたオブジェクト
 */
export const toTimeTableSource = (api: TimeTableApi): TimeTableSource => {
    console.log(api.timeBlocks?.map(block => toTimeBlockSource(block)))
    return {
        id: api.id,
        date: fromDateString(api.date),
        blocks: api.timeBlocks?.map(block => toTimeBlockSource(block)) || [],
    };
};