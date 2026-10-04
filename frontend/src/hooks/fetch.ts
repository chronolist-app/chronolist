import axios from "@/utils/axios";
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
    });
    return res.data as T;
};

export const useReadOnlyFetch = <T,>(
    app: string,
    method?: HttpMethod,
    body?: unknown,
) => {

    const [data, setDate] = useState<T>();
    const [isLoading, setLoading] = useState(true);
    const [error, setError] = useState<Error>();

    useEffect(() => {
        const fetchData = async () => {
            const config: FetchConfig = {
                url: app,
                method: method = "GET",
                data: body,
            };
            try {
                const res = await customizedFetch<T>(config);
                setDate(res);
            } catch (error) {
                setError(error as Error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return { data, isLoading, error };
};