import { customizedFetch } from "@/utils/fetch";
import type { TimeBlockTask } from "../../types/blockSourceTypes";

const update = async (task: TimeBlockTask) => {

    const submitData = {
        id: task.id,
        timeBlockId: task.timeBlockId,
        title: task.title
    }

    await customizedFetch<void>(
        {
            url: "/timeblocking/timeBlockTask/update",
            method: "PUT",
            data: submitData,
        }
    );
}

export default update;