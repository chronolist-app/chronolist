import test from "node:test";
import assert from "node:assert/strict";
import { isViteDevelopmentResponse } from "../e2e/vite-environment.ts";

test("Vite clientのJavaScriptだけを開発環境として扱う", () => {
    assert.equal(isViteDevelopmentResponse(200, "text/javascript; charset=utf-8"), true);
    assert.equal(isViteDevelopmentResponse(200, "application/javascript"), true);
    assert.equal(isViteDevelopmentResponse(200, "text/html; charset=utf-8"), false);
    assert.equal(isViteDevelopmentResponse(404, "text/html"), false);
});

test("障害や予期しない応答を非開発環境として隠さない", () => {
    for (const status of [401, 403, 500, 503]) assert.throws(() => isViteDevelopmentResponse(status, "text/html"));
    assert.throws(() => isViteDevelopmentResponse(200, "application/json"));
});
