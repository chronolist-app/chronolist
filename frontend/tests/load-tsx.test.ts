import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("TSX共通読込は正常終了と読込失敗の一時ディレクトリを削除する", async () => {
    const root = fileURLToPath(new URL("../node_modules/.tmp/", import.meta.url));
    await mkdir(root, { recursive: true });
    const isolated = await mkdtemp(`${root}/helper-cleanup-`);
    try {
        await mkdir(`${isolated}/tests/helpers`, { recursive: true });
        const helperSource = await readFile(new URL("./helpers/load-tsx.ts", import.meta.url), "utf8");
        await writeFile(`${isolated}/tests/helpers/load-tsx.mjs`, ts.transpileModule(helperSource, {
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText);
        await writeFile(`${isolated}/component.tsx`, 'export default function Example() { return <input aria-label="入力" />; }');
        await writeFile(`${isolated}/cleanup.test.mjs`, `import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { loadTsx } from './tests/helpers/load-tsx.mjs';
test('正常読込', async () => {
    const module = await loadTsx(new URL('./component.tsx', import.meta.url));
    assert.equal(typeof module.default, 'function');
});
test('失敗時も即時削除', async () => {
    const before = await readdir(new URL('./node_modules/.tmp/', import.meta.url));
    await assert.rejects(loadTsx(new URL('./missing.tsx', import.meta.url)), { code: 'ENOENT' });
    assert.deepEqual(await readdir(new URL('./node_modules/.tmp/', import.meta.url)), before);
});`);
        await promisify(execFile)(process.execPath, ["--test", `${isolated}/cleanup.test.mjs`], {
            env: { ...process.env, NODE_TEST_CONTEXT: undefined },
        });
        assert.deepEqual(await readdir(`${isolated}/node_modules/.tmp`), [], "子プロセスのafterで正常読込分も削除する");
    } finally {
        await rm(isolated, { recursive: true, force: true });
    }
});
