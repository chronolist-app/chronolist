import type { TimeBlockSource } from "../../types/blockSourceTypes";
import { customizedFetch } from "@/utils/fetch";
import { toDateString, toDateTimeString } from "@/utils/date";


const update = async (block: TimeBlockSource) => {
    const schedule = block.relatedSchedle;

    const newBlock =  {
        id: block.id,
        timeTableId: block.timeTableId,
        title: block.title,
        status: block.status,
        relatedSchedule: schedule && {
            id: schedule.id,
            kind: schedule.kind,
            title: schedule.title,
            startAt: schedule.startAt ? toDateTimeString(schedule.startAt) : null,
            endAt: schedule.endAt ? toDateTimeString(schedule.endAt) : null,
            startDate: schedule.startDate ? toDateString(schedule.startDate) : null,
            endDate: schedule.endDate ? toDateString(schedule.endDate) : null,
        },
        width: block.width,
        startAt: block.startAt?.toString(),
        tasks: block.tasks.map(task => {
            return {
                id: task.id,
                title: task.title,
            }
        }),
        color: block.color,
    };

    await customizedFetch<void>(
        {
            url: "/timeblocking/timeBlock/update",
            method: "PUT",
            data: newBlock,
        }
    )
};

export default update;
