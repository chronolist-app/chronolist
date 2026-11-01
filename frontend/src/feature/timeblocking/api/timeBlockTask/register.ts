
import axios from "@/utils/axios";
import type { TimeBlockTask } from "../../types/blockSourceTypes";

/**
 * タイムブロックタスクを登録するAPI
 * 
 * @param task 登録するタスク
 * @returns サーバーで発行された登録したタスクのID
 */
const register = async (task: TimeBlockTask) => {

    // テスト用コード
    console.log("timeblocking/timeBlockTask/register");
    console.log("task: ", task);

    const res = await axios.put(
        "timeblocking/timeBlockTask/register",
        task,
    );
    return res.data as number;
};

export default register;