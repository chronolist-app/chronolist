import { customizedFetch } from "@/utils/fetch"
import type { DateString } from "@/types/date";


const createAt = async (date: DateString) => {
    try {
        const res = await customizedFetch<number>({
            url: "/timeblocking/timeTable/createAt",
            method: "POST",
            data: { date },
        });
        return res;
    } catch (error) {
        throw error;
    }
};

export default createAt;