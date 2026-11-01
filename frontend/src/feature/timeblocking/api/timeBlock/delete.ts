import { customizedFetch } from "@/utils/fetch";


const deleteApi = async (id: number) => {

    await customizedFetch<void>(
        {
            url: "/timeblocking/timeBlock/delete",
            method: "DELETE",
            data: { id },
        }
    )
};

export default deleteApi;