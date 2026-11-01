import { customizedFetch } from "@/utils/fetch";
import { toTemplateBlockSource } from "../../mapper/blockMapper";
import type { TemplateBlockApi } from "../../types/api";
import { AxiosError } from "axios";
import { ApiError } from "@/error/common";

const getAll = async (): Promise<ReturnType<typeof toTemplateBlockSource>[]> => {
    try {
        const res = await customizedFetch<TemplateBlockApi[]>({
            url: "/timeblocking/templateBlock/getAll",
            method: "GET",
        });
        if (res === null) return [];
        return res.map(api => toTemplateBlockSource(api));
    } catch (error: unknown) {
        if (error instanceof AxiosError) {
            throw new ApiError("何らかのAPIエラーが発生", error.status, { cause: error });
        }
        throw error;
    }
};

export default getAll;