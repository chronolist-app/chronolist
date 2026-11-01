import { ApiError } from "@/error/common";
import { customizedFetch } from "@/utils/fetch";
import { AxiosError } from "axios";

const deleteApi = async (id: number) => {
    try {
        await customizedFetch<void>({
            url: "/timeblocking/templateBlock/delete",
            method: "DELETE",
            data: { id },
        });
    } catch (error) {
        if (error instanceof AxiosError) {
            throw new ApiError("何らかのAPIエラーが発生", error.status, { cause: error });
        }
        throw error;
    }
};

export default deleteApi;