import { customizedFetch } from "@/utils/fetch";
import type { TimeBlockSource } from "../../types/blockSourceTypes";
import { AxiosError } from "axios";
import { ApiError } from "@/error/common";
import type { TimeBlockApi } from "../../types/api";
import { toTimeBlockSource } from "../../mapper/blockMapper";

const getHoldBlocks = async (): Promise<TimeBlockSource[]> => {
    try {
        const res = await customizedFetch<TimeBlockApi[]>({
            url: "/timeblocking/timeBlock/getHoldBlocks",
            method: "GET",
        });
        if (res === null) return [];
        return res.map(api => toTimeBlockSource(api));
    } catch (error: unknown) {
        if (error instanceof AxiosError) {
            throw new ApiError("何らかのAPIエラーが発生", error.status, { cause: error });
        }
        throw error;
    }
}

export default getHoldBlocks;