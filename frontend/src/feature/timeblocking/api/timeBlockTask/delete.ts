import { customizedFetch } from "@/utils/fetch"

const deleteApi = async (id: number) => {
    await customizedFetch<void>(
        {
            url: "/timeblocking/timeBlockTask/delete",
            method: "DELETE",
            data: { id },
        }
    );
};

export default deleteApi;