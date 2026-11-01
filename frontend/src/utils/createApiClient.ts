import Axios from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { createCsrfTokenManager, CsrfTokenUnavailableError } from "./csrfTokenManager.ts";

type ClientOptions = {
    notify: (message: string) => void;
    currentPath: () => string;
    redirectToLogin: () => void;
    adapter?: AxiosAdapter;
};

export function createApiClient(baseURL: string, options: ClientOptions) {
    const config = { baseURL, withCredentials: true, ...(options.adapter ? { adapter: options.adapter } : {}) };
    const client = Axios.create(config);
    // This transport has no interceptors: token failures cannot recursively trigger recovery.
    const tokenTransport = Axios.create(config);
    const csrf = createCsrfTokenManager(async (signal) =>
        (await tokenTransport.get("csrf", { signal })).data as unknown);
    const generations = new WeakMap<InternalAxiosRequestConfig, number>();
    const base = new URL(baseURL);
    const loginPath = new URL("login", base).pathname;
    const logoutPath = new URL("logout", base).pathname;
    let redirecting = false;

    function apiPath(request: InternalAxiosRequestConfig): string | undefined {
        const url = new URL(client.getUri(request), base);
        return url.origin === base.origin && url.pathname.startsWith(base.pathname) ? url.pathname : undefined;
    }

    client.interceptors.request.use(async (request) => {
        if (apiPath(request) && ["post", "put", "patch", "delete"].includes(request.method?.toLowerCase() ?? "")) {
            const state = await csrf.get();
            generations.set(request, state.generation);
            request.headers.set(state.headerName, state.token, true);
        }
        return request;
    });

    client.interceptors.response.use(async (response) => {
        const path = apiPath(response.config);
        if (response.config.method?.toLowerCase() === "post" && (path === loginPath || path === logoutPath)) {
            csrf.invalidate();
            try {
                await csrf.get();
            } catch {
                options.notify(path === loginPath
                    ? "ログインは完了しました。通信状況を確認してから、次の操作をお試しください。"
                    : "ログアウトしました。通信状況を確認してから、次の操作をお試しください。");
            }
        }
        return response;
    }, async (error: unknown) => {
        if (error instanceof CsrfTokenUnavailableError) {
            options.notify("操作の準備ができませんでした。通信状況を確認して、もう一度操作してください。");
            return Promise.reject(error);
        }
        if (!Axios.isAxiosError(error) || !error.config) return Promise.reject(error);
        const path = apiPath(error.config);
        if (!path) return Promise.reject(error);
        if (error.response?.status === 401 && path !== loginPath) {
            csrf.invalidate();
            if (options.currentPath() !== "/login" && !redirecting) {
                redirecting = true;
                options.redirectToLogin();
            }
        } else if (error.response?.status === 403 && error.response.data?.code === "CSRF_TOKEN_INVALID") {
            const sentGeneration = generations.get(error.config);
            // Late failures from an old generation must not clear a newer token.
            if (sentGeneration === csrf.generation()) csrf.invalidate();
            try {
                await csrf.get();
                options.notify("操作を完了できませんでした。画面を再読み込みしてから、もう一度操作してください。");
            } catch {
                options.notify("操作を完了できませんでした。通信状況を確認し、画面を再読み込みしてから操作してください。");
            }
        }
        // Never replay a failed mutation, including login/logout.
        return Promise.reject(error);
    });
    return client;
}
