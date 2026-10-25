export type CsrfToken = { token: string; headerName: string };
export type CsrfState = CsrfToken & { generation: number };

export class CsrfTokenUnavailableError extends Error {
    constructor(cause: unknown) {
        super("Could not obtain a CSRF token", { cause });
        this.name = "CsrfTokenUnavailableError";
    }
}

/** Keep only the current authentication generation's token, sharing concurrent fetches. */
export function createCsrfTokenManager(fetchToken: (signal: AbortSignal) => Promise<unknown>) {
    let generation = 0;
    let cached: CsrfState | undefined;
    let pending: Promise<CsrfState> | undefined;
    let controller: AbortController | undefined;

    function invalidate() {
        generation += 1;
        cached = undefined;
        pending = undefined;
        controller?.abort();
        controller = undefined;
    }

    function get(): Promise<CsrfState> {
        if (cached) return Promise.resolve(cached);
        if (pending) return pending;
        const requestedGeneration = generation;
        controller = new AbortController();
        const signal = controller.signal;
        const request = Promise.resolve().then(() => fetchToken(signal)).then((value) => {
            if (requestedGeneration !== generation) return get();
            if (typeof value !== "object" || value === null || !("token" in value) ||
                !("headerName" in value) || typeof value.token !== "string" || !value.token ||
                value.headerName !== "X-CSRF-TOKEN") {
                throw new Error("Invalid CSRF response");
            }
            cached = { token: value.token, headerName: value.headerName, generation };
            return cached;
        }).catch((error: unknown) => {
            if (requestedGeneration !== generation) return get();
            throw new CsrfTokenUnavailableError(error);
        }).finally(() => {
            if (pending === request) {
                pending = undefined;
                controller = undefined;
            }
        });
        pending = request;
        return request;
    }

    return { get, invalidate, generation: () => generation };
}
