import { customizedFetch } from "@/utils/fetch";
import type { TemplateBlockSource } from "../../types/blockSourceTypes";
import { AxiosError } from "axios";
import { ApiError } from "@/error/common";

const update = async (block: TemplateBlockSource) => {
    try {
        await customizedFetch<void>(
            {
                url: "/timeblocking/templateBlock/update",
                method: "PUT",
                data: block,
            }
        )
    } catch (error) {
        if (error instanceof AxiosError) {
            throw new ApiError("何らかのAPIエラーが発生", error.status, { cause: error });
        }
        throw error;
    }
};

export default update;