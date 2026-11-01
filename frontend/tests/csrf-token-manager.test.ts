import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfTokenManager, CsrfTokenUnavailableError } from "../src/utils/csrfTokenManager.ts";

const token = (value: string) => ({ token: value, headerName: "X-CSRF-TOKEN" });

test("concurrent callers share one acquisition and the cached result", async () => {
    const fetch = Promise.withResolvers<unknown>();
    let calls = 0;
    const manager = createCsrfTokenManager(() => { calls++; return fetch.promise; });
    const first = manager.get();
    const second = manager.get();
    fetch.resolve(token("one"));
    assert.equal((await first).token, "one");
    assert.equal(await first, await second);
    assert.equal((await manager.get()).token, "one");
    assert.equal(calls, 1);
});

for (const outcome of ["success", "failure"]) {
    test(`obsolete ${outcome} cannot overwrite or clear a new generation's pending token`, async () => {
        const oldFetch = Promise.withResolvers<unknown>();
        const newFetch = Promise.withResolvers<unknown>();
        let calls = 0;
        let oldSignal: AbortSignal | undefined;
        const manager = createCsrfTokenManager((signal) => {
            calls++;
            if (calls === 1) { oldSignal = signal; return oldFetch.promise; }
            return newFetch.promise;
        });
        const old = manager.get();
        await Promise.resolve();
        manager.invalidate();
        assert.equal(oldSignal?.aborted, true);
        const current = manager.get();
        if (outcome === "success") oldFetch.resolve(token("obsolete"));
        else oldFetch.reject(new Error("obsolete request failed"));
        newFetch.resolve(token("current"));
        assert.equal((await old).token, "current");
        assert.equal(await current, await manager.get());
        assert.equal(calls, 2);
    });
}

test("acquisition failure is not cached and a later operation can try again", async () => {
    let calls = 0;
    const manager = createCsrfTokenManager(async () => {
        if (++calls === 1) throw new Error("offline");
        return token("recovered");
    });
    await assert.rejects(manager.get(), CsrfTokenUnavailableError);
    assert.equal((await manager.get()).token, "recovered");
    assert.equal(calls, 2);
});
