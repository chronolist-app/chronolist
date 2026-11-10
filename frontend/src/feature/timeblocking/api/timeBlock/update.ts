import type { TimeBlockSource } from "../../types/blockSourceTypes";
import { customizedFetch } from "@/utils/fetch";


const update = async (block: TimeBlockSource) => {
    const newBlock =  {
        id: block.id,
        timeTableId: block.timeTableId,
        title: block.title,
        status: block.status,
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
