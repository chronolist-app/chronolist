import { v4 as uuidv4 } from "uuid";
import type { TimeBlockTaskApi } from "../types/api";
import type { TimeBlockTask } from "../types/blockSourceTypes";


export const toTimeBlockTask = (api: TimeBlockTaskApi, clientId?: string): TimeBlockTask => {
    return {
        id: api.id,
        timeBlockId: api.timeBlockId,
        clientId: clientId || uuidv4(),
        title: api.title,
    };
};