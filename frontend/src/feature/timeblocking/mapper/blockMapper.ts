import { toScheduleSource } from "@/feature/schesuler/mapper/scheduleMapper";
import { v4 as uuidv4 } from "uuid";
import type { TemplateBlockApi, TimeBlockApi } from "../types/api";
import type { TemplateBlockSource, TimeBlockSource } from "../types/blockSourceTypes";
import { Time } from "@/utils/time";
import { toTimeBlockTask } from "./timeBlockTask";


/**
 * `TimeBlockApi` を `TimeBlockSource` に変換するマッパー関数.
 * 
 * @param api APIオブジェクト
 * @returns 変換されたオブジェクト
 */
export const toTimeBlockSource = (api: TimeBlockApi, clientId?: string): TimeBlockSource => {
    return {
        id: api.id,
        clientId: clientId || uuidv4(),
        timeTableId: api.timeTableId,
        title: api.title,
        status: api.status,
        relatedSchedle: api.relatedSchedle && toScheduleSource(api.relatedSchedle),
        width: api.width,
        startAt: api.startAt ? new Time(api.startAt) : null,
        tasks: api.tasks?.map(task => toTimeBlockTask(task)) || [],
        color: api.color,
    };
};

/**
 * `TemplateBlockApi` を `TemplateBlockSource` に変換するマッパー関数.
 * 
 * @param api APIオブジェクト
 * @returns 変換されたオブジェクト
 */
export const toTemplateBlockSource = (api: TemplateBlockApi, clientId?: string): TemplateBlockSource => {
    return {
        id: api.id,
        clientId: clientId || uuidv4(),
        title: api.title,
        width: api.width,
        color: api.color,
    };
};