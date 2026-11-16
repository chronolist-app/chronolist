import type { TimeBlockTaskApi } from "../types/api";
import type { TimeBlockTask } from "../types/blockSourceTypes";


export const toTimeBlockTask = (api: TimeBlockTaskApi): TimeBlockTask => {
    return {
        id: api.id,
        timeBlockId: api.timeBlockId,

        title: api.title,
    };
};