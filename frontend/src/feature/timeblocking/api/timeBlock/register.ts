import { customizedFetch } from "@/utils/fetch";
import type { TimeBlockSource } from "../../types/blockSourceTypes";


const register = async (block: TimeBlockSource) => {
    const data = {
        timeTableId: block.timeTableId,
        title: block.title,
        status: block.status,
        width: block.width,
        startAt: block.startAt?.toString(),
        tasks: block.tasks,
        color: block.color,
    };

    const res = await customizedFetch<number>(
        {
            url: "/timeblocking/timeBlock/register",
            method: "PUT",
            data,
        }
    )
    console.log("new id: ", res);
    return res;
};

export default register;