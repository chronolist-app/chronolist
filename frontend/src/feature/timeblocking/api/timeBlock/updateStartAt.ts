import { customizedFetch } from "@/utils/fetch";
import type { Time } from "@/utils/time"

const updateStartAt = async (id: number, startAt: Time) => {

    await customizedFetch<void>(
        {
            url: "/timeblocking/timeBlock/update/startAt",
            method: "PUT",
            data: {
                id: id,
                startAt: startAt.toString(),
            },
        }
    )
};

export default updateStartAt;