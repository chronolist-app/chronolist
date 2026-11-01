import axios from "./axios";
import type { AxiosRequestConfig } from "axios";
import { useEffect, useState } from "react";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type FetchConfig = {
    url: string;
    method: HttpMethod;
    data?: unknown;
}

export const customizedFetch = async <T,>(config: FetchConfig) => {
    const url = config.url?.startsWith("/")? config.url : `/${config.url}`;
    const res = await axios({
        ...config,
        url,
        withCredentials: true,
    });
    return res.data as T;
};

/**
 * `Axios` を利用したデータフェッチカスタムフック.
 * @param app アプリケーション名
 * @returns 返却データを保持する連想配列
 */
const useFetch = <T,>(app: string, method?: HttpMethod, body?: unknown) => {
    
    const url = app.startsWith("/")? app : `/${app}`;

    const [data, setDate] = useState<T>();
    const [isLoading, setLoading] = useState(true);
    const [error, setError] = useState<Error>();

    useEffect(() => {
        const fetchData = async () => {
            try{
                const config: AxiosRequestConfig = {
                    url: url,
                    method: method,
                    data: body,
                };
                const res = await axios(config);
                setDate(res.data);
            } catch (error) {
                setError(error as Error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [url]);

    return { data, isLoading, error };
}

export default useFetch;
