import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { createApiClient } from "../src/utils/createApiClient.ts";
import { CsrfTokenUnavailableError } from "../src/utils/csrfTokenManager.ts";

const path = (config: InternalAxiosRequestConfig) => config.url?.replace(/^\//, "");
const response = (config: InternalAxiosRequestConfig, data: unknown = {}): AxiosResponse =>
    ({ data, config, headers: {}, status: 200, statusText: "OK" });
function failure(config: InternalAxiosRequestConfig, status: number, code: string): AxiosError {
    return new AxiosError("request failed", undefined, config, undefined,
        { ...response(config, { code }), status, statusText: "Failed" });
}
type Handler = (config: InternalAxiosRequestConfig, tokenFetches: number) =>
    AxiosResponse | Promise<AxiosResponse> | undefined;

function harness(handler?: Handler, currentPath = "/todolist") {
    const requests: InternalAxiosRequestConfig[] = [];
    const notices: string[] = [];
    let fetches = 0;
    let redirects = 0;
    const client = createApiClient("https://chronolist.test/api/", {
        notify: (message) => notices.push(message),
        currentPath: () => currentPath,
        redirectToLogin: () => { redirects++; },
        adapter: async (config) => {
            requests.push(config);
            if (path(config) === "csrf") fetches++;
            const custom = handler?.(config, fetches);
            if (custom !== undefined) return custom;
            return response(config, path(config) === "csrf"
                ? { token: `token-${fetches}`, headerName: "X-CSRF-TOKEN" } : {});
        },
    });
    return { client, requests, notices, fetches: () => fetches, redirects: () => redirects };
}

test("read requests do not fetch or attach CSRF tokens", async () => {
    const h = harness();
    for (const method of ["GET", "HEAD", "OPTIONS"]) await h.client.request({ method, url: "tasks" });
    assert.equal(h.fetches(), 0);
    assert(h.requests.every((config) => !config.headers.has("X-CSRF-TOKEN")));
});

test("concurrent POST PUT PATCH DELETE share acquisition and send credentials and token", async () => {
    const h = harness();
    await Promise.all(["POST", "PUT", "PATCH", "DELETE"].map((method) =>
        h.client.request({ method, url: "/tasks", data: { value: 1 } })));
    assert.equal(h.fetches(), 1);
    assert(h.requests.every((config) => config.withCredentials));
    assert.equal(h.requests.filter((config) => path(config) === "tasks").length, 4);
    assert(h.requests.filter((config) => path(config) === "tasks")
        .every((config) => config.headers.get("X-CSRF-TOKEN") === "token-1"));
});

test("tokens are not attached to URLs outside the configured API", async () => {
    const h = harness();
    await h.client.post("https://other.test/collect");
    assert.equal(h.fetches(), 0);
    assert.equal(h.requests[0].headers.has("X-CSRF-TOKEN"), false);
});

test("failed token acquisition stops the mutation, notifies, and allows a later new operation", async () => {
    const h = harness((config, fetches) => {
        if (path(config) === "csrf" && fetches === 1) throw failure(config, 503, "UNAVAILABLE");
    });
    await assert.rejects(h.client.post("tasks"), CsrfTokenUnavailableError);
    assert.equal(h.requests.filter((config) => path(config) === "tasks").length, 0);
    assert.equal(h.notices.length, 1);
    await h.client.post("tasks");
    assert.equal(h.fetches(), 2);
    assert.equal(h.requests.filter((config) => path(config) === "tasks").length, 1);
});

test("malformed token data cannot be used as a request header", async () => {
    for (const payload of [{}, { token: "", headerName: "X-CSRF-TOKEN" }, { token: "bad", headerName: "Authorization" }]) {
        const h = harness((config) => path(config) === "csrf" ? response(config, payload) : undefined);
        await assert.rejects(h.client.post("tasks"), CsrfTokenUnavailableError);
        assert.equal(h.requests.length, 1);
    }
});

for (const endpoint of ["login", "logout"]) {
    test(`${endpoint} success refreshes the token before subsequent mutations`, async () => {
        const h = harness();
        await h.client.post(`/${endpoint}`);
        await h.client.post("tasks");
        assert.equal(h.fetches(), 2);
        assert.equal(h.requests.find((config) => path(config) === endpoint)?.headers.get("X-CSRF-TOKEN"), "token-1");
        assert.equal(h.requests.find((config) => path(config) === "tasks")?.headers.get("X-CSRF-TOKEN"), "token-2");
    });

    test(`${endpoint} success remains successful when its refresh fails`, async () => {
        const h = harness((config, fetches) => {
            if (path(config) === "csrf" && fetches === 2) throw failure(config, 503, "UNAVAILABLE");
        });
        assert.equal((await h.client.post(endpoint)).status, 200);
        assert.equal(h.notices.length, 1);
        assert.equal(h.redirects(), 0);
        await h.client.post("tasks");
        assert.equal(h.fetches(), 3);
        assert.equal(h.requests.filter((config) => path(config) === endpoint).length, 1);
    });
}

test("failed login keeps its token and does not redirect or replay credentials", async () => {
    let attempts = 0;
    const h = harness((config) => {
        if (path(config) === "login" && ++attempts === 1) throw failure(config, 401, "UNAUTHENTICATED");
    });
    await assert.rejects(h.client.post("login"));
    assert.equal(attempts, 1);
    assert.equal(h.redirects(), 0);
    await h.client.post("login");
    assert.equal(h.requests.filter((config) => path(config) === "login")[1].headers.get("X-CSRF-TOKEN"), "token-1");
});

test("CSRF 403 recovers the token but never replays the failed mutation", async () => {
    let attempts = 0;
    const h = harness((config) => {
        if (path(config) === "tasks" && ++attempts === 1) throw failure(config, 403, "CSRF_TOKEN_INVALID");
    });
    await assert.rejects(h.client.post("tasks"));
    assert.equal(attempts, 1);
    assert.equal(h.fetches(), 2);
    assert.equal(h.notices.length, 1);
    await h.client.post("tasks");
    assert.equal(attempts, 2);
    assert.equal(h.requests.filter((config) => path(config) === "tasks")[1].headers.get("X-CSRF-TOKEN"), "token-2");
});

test("simultaneous CSRF failures share a single recovery", async () => {
    const h = harness((config) => {
        if (path(config) === "tasks") throw failure(config, 403, "CSRF_TOKEN_INVALID");
    });
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => h.client.post("tasks")));
    assert(results.every((result) => result.status === "rejected"));
    assert.equal(h.fetches(), 2);
    assert.equal(h.requests.filter((config) => path(config) === "tasks").length, 4);
});

test("failed recovery preserves the original error and does not recurse or replay", async () => {
    let attempts = 0;
    let original: AxiosError | undefined;
    const h = harness((config, fetches) => {
        if (path(config) === "tasks" && ++attempts === 1) {
            original = failure(config, 403, "CSRF_TOKEN_INVALID");
            throw original;
        }
        if (path(config) === "csrf" && fetches === 2) throw failure(config, 403, "CSRF_TOKEN_INVALID");
    });
    await assert.rejects(h.client.post("tasks"), (error) => error === original);
    assert.equal(attempts, 1);
    assert.equal(h.fetches(), 2);
    assert.equal(h.notices.length, 1);
    await h.client.post("tasks");
    assert.equal(h.fetches(), 3);
    assert.equal(attempts, 2);
});

test("late CSRF failure from before login cannot invalidate the new token", async () => {
    const delayed = Promise.withResolvers<AxiosResponse>();
    let oldRequest: InternalAxiosRequestConfig | undefined;
    const dispatched = Promise.withResolvers<void>();
    const h = harness((config) => {
        if (path(config) === "old-task") { oldRequest = config; dispatched.resolve(); return delayed.promise; }
    });
    const old = h.client.post("old-task");
    const rejected = assert.rejects(old);
    await dispatched.promise;
    await h.client.post("login");
    delayed.reject(failure(oldRequest!, 403, "CSRF_TOKEN_INVALID"));
    await rejected;
    await h.client.post("tasks");
    assert.equal(h.fetches(), 2);
    assert.equal(h.requests.find((config) => path(config) === "tasks")?.headers.get("X-CSRF-TOKEN"), "token-2");
});

test("ordinary permission failures do not recover or notify as CSRF failures", async () => {
    const h = harness((config) => path(config) === "tasks"
        ? Promise.reject(failure(config, 403, "ACCESS_DENIED")) : undefined);
    await assert.rejects(h.client.post("tasks"));
    assert.equal(h.fetches(), 1);
    assert.deepEqual(h.notices, []);
});

test("401 redirects once, with no redirect when already on the login page", async () => {
    for (const currentPath of ["/tasks", "/login"]) {
        const h = harness((config) => Promise.reject(failure(config, 401, "UNAUTHENTICATED")), currentPath);
        await Promise.allSettled([h.client.get("tasks"), h.client.get("tasks")]);
        assert.equal(h.redirects(), currentPath === "/login" ? 0 : 1);
        assert.equal(h.fetches(), 0);
    }
});
