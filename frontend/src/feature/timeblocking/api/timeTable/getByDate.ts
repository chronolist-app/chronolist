import { customizedFetch } from "@/utils/fetch";
import { toTimeTableSource } from "../../mapper/timeTableMapper";
import type { TimeTableApi } from "../../types/api";
import { AxiosError } from "axios";
import { ApiError, NotFoundError } from "@/error/common";
import type { DateString } from "@/types/date";


const getByDate = async (date: DateString) => {
    try {
        const response = await customizedFetch<TimeTableApi>({
            url: `/timeblocking/timeTable/getByDate/${date}`,
            method: "GET",
        });
        console.log("response: ", response);
        return toTimeTableSource(response);
    } catch (error: unknown) {
        if (error instanceof AxiosError) {
            if (error.status === 404){
                throw new NotFoundError("TimeTable not found.");
            }
            throw new ApiError("何らかのAPIエラーが発生", error.status, { cause: error });
        }
        throw error;
    }
};

export default getByDate;