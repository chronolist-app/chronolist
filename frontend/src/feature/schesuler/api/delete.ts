import { ApiError } from "@/error/common";
import { customizedFetch } from "@/utils/fetch";
import { AxiosError } from "axios";


const deleteEvent = async (id: number) => {
    try {
        await customizedFetch<void>({
            url: `/scheduler/delete/${id}`,
            method: "DELETE",
        });
    } catch (err: unknown) {
        if (err instanceof AxiosError) {
            throw new ApiError("何らかのAPIエラーが発生", err.status, { cause: err });
        }
        throw err;
    }
};

export default deleteEvent;