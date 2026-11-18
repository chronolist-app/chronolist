import { after } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

/** TSX単体を既存TypeScriptで変換して読み込み、テスト終了時に一時ファイルを削除する。 */
export async function loadTsx<TModule extends object>(source: URL): Promise<TModule> {
    // node_modules配下ならbare importを解決でき、中断時の残骸もgit・lint対象外になる。
    const temporaryRoot = fileURLToPath(new URL("../../node_modules/.tmp/", import.meta.url));
    await mkdir(temporaryRoot, { recursive: true });
    const directory = await mkdtemp(`${temporaryRoot}/tsx-test-`);
    const cleanup = () => rm(directory, { recursive: true, force: true });
    after(cleanup);
    try {
        const code = await readFile(source, "utf8");
        const modulePath = `${directory}/component.mjs`;
        await writeFile(modulePath, ts.transpileModule(code, {
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText);
        // 呼出元が元TSXのtypeof importを指定し、動的importの型境界を一箇所に閉じ込める。
        const loaded: unknown = await import(pathToFileURL(modulePath).href);
        return loaded as TModule;
    } catch (error) {
        await cleanup();
        throw error;
    }
}
