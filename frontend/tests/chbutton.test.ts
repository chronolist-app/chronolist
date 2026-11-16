import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CHButtonProps } from "../src/components/CHButton.tsx";

// Node標準ランナーでTSXを実行するため、既存のTypeScriptだけで一時変換する。
const DIRECTORY = await mkdtemp(fileURLToPath(new URL(".chbutton-", import.meta.url)));
after(() => rm(DIRECTORY, { recursive: true, force: true }));
const SOURCE = await readFile(new URL("../src/components/CHButton.tsx", import.meta.url), "utf8");
const MODULE_PATH = `${DIRECTORY}/CHButton.mjs`;
await writeFile(MODULE_PATH, ts.transpileModule(SOURCE, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { default: CHButton } = await import(pathToFileURL(MODULE_PATH).href);
const render = (props: CHButtonProps) => renderToStaticMarkup(createElement(CHButton, props));

test("既定値はprimary/contained/mdのbuttonでラベルをエスケープする", () => {
    const html = render({ label: "作成<&" });
    assert.match(html, /type="button"/);
    assert.match(html, /MuiButton-contained/);
    assert.match(html, /background-color:#1976D2/);
    assert.match(html, /min-height:52px/);
    assert.match(html, /min-height:36px/);
    assert.match(html, /作成&lt;&amp;/);
    assert.doesNotMatch(html, /disabled=""/);
});

test("全9組が状態色とフォーカス・disabledスタイルを持つ", () => {
    for (const [variant, base, hover, active, light, pressed] of [
        ["primary", "#1976D2", "#1565C0", "#0D47A1", "#E3F2FD", "#BBDEFB"],
        ["secondary", "#475569", "#334155", "#1E293B", "#F1F5F9", "#E2E8F0"],
        ["danger", "#D32F2F", "#C62828", "#B71C1C", "#FFEBEE", "#FFCDD2"],
    ] as const) {
        for (const appearance of ["contained", "outlined", "text"] as const) {
            const html = render({ label: "実行", variant, appearance, disabled: true });
            assert.ok(html.includes(`color:${appearance === "contained" ? "#FFFFFF" : base}`));
            assert.ok(html.includes(`background-color:${appearance === "contained" ? hover : light}`));
            assert.ok(html.includes(`background-color:${appearance === "contained" ? active : pressed}`));
            assert.ok(html.includes(`outline:2px solid ${base}`));
            assert.match(html, /outline-offset:2px/);
            assert.match(html, /color:#6B7280/);
            assert.match(html, /disabled=""/);
        }
    }
});

test("全5段階で600px境界の寸法と文字・アイコン寸法を出力する", () => {
    for (const [size, mobileHeight, desktopHeight, mobilePadding, desktopPadding, mobileFont, desktopFont, mobileIcon, desktopIcon] of [
        ["xs", 44, 28, 12, 8, 13, 12, 9, 8],
        ["sm", 48, 32, 16, 12, 14, 13, 10, 9],
        ["md", 52, 36, 20, 16, 15, 14, 11, 10],
        ["lg", 56, 40, 24, 20, 16, 15, 12, 11],
        ["xl", 60, 44, 28, 24, 17, 16, 13, 12],
    ] as const) {
        const html = render({ label: "サイズ", size });
        assert.match(html, /@media \(min-width:600px\)/);
        for (const value of [mobileHeight, desktopHeight]) assert.ok(html.includes(`min-height:${value}px`));
        for (const value of [mobilePadding, desktopPadding]) assert.ok(html.includes(`padding-left:${value}px`));
        for (const value of [mobileFont, desktopFont]) assert.ok(html.includes(`font-size:${value / 16}rem`));
        for (const value of [mobileIcon, desktopIcon]) assert.ok(html.includes(`width:${value}px`));
    }
});

test("アイコンは装飾としてラベルと並び、長文の折返しと高さ拡張を許可する", () => {
    const label = "長いラベル".repeat(30);
    const html = render({ label, startIcon: createElement("svg", { "data-testid": "icon" }) });
    assert.match(html, /class="CHButton-icon" aria-hidden="true"><svg/);
    assert.ok(html.indexOf('data-testid="icon"') < html.indexOf(label));
    for (const style of ["gap:2px", "justify-content:center", "align-items:center", "min-width:0", "white-space:normal", "overflow-wrap:anywhere", "max-width:100%", "text-transform:none", "border-radius:8px"]) {
        assert.ok(html.includes(style), style);
    }
    for (const [, selector, declarations] of html.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!selector.includes("CHButton-icon")) assert.doesNotMatch(declarations, /(?:^|;)(?:height|width):\d+px/);
    }
});

test("submit/resetをネイティブボタンへ渡す", () => {
    for (const type of ["submit", "reset"] as const) assert.ok(render({ label: type, type }).includes(`type="${type}"`));
});

test("非描画のアイコン値では領域を生成せず、数値0は保持する", () => {
    for (const startIcon of [false, true, null, undefined, ""]) {
        const html = render({ label: "作成", startIcon });
        assert.doesNotMatch(html, /class="CHButton-icon"/);
        assert.match(html, /class="CHButton-label">作成<\/span>/);
    }
    assert.match(render({ label: "作成", startIcon: 0 }), /class="CHButton-icon" aria-hidden="true">0<\/span>/);
});
