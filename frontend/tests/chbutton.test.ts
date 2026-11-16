import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
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

test("リンクは遷移先を持つアンカーとして描画し、buttonの属性を付けない", () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/timeblocking"] },
        createElement(CHButton, { label: "スケジューラで編集", link: { to: "/scheduler", state: { date: "2026-11-17", eventId: 12 } } })));
    assert.match(html, /<a[^>]*href="\/scheduler"/);
    assert.match(html, /class="CHButton-label">スケジューラで編集<\/span>/);
    assert.doesNotMatch(html, /<button|type="button"|role="button"/);
    assert.doesNotMatch(html, /eventId|2026-11-17/, "遷移stateをDOM属性へ漏らさない");
});

type CssRule = { selector: string; media: string[]; declarations: Record<string, string> };

// Emotionが出力する通常ルールと@mediaだけを読み、セレクタと条件の対応を保持する。
const extractRules = (css: string, media: string[] = []): CssRule[] => {
    const rules: CssRule[] = [];
    let cursor = 0;
    while (cursor < css.length) {
        const open = css.indexOf("{", cursor);
        if (open === -1) break;
        const selector = css.slice(cursor, open).trim();
        let end = open + 1;
        let depth = 1;
        while (depth > 0 && end < css.length) {
            if (css[end] === "{") depth++;
            if (css[end] === "}") depth--;
            end++;
        }
        assert.equal(depth, 0, "CSSブロックが閉じていること");
        const body = css.slice(open + 1, end - 1);
        if (selector.startsWith("@media ")) {
            rules.push(...extractRules(body, [...media, selector.slice(7)]));
        } else {
            assert.ok(!selector.startsWith("@"), `未対応のCSS規則: ${selector}`);
            const declarations: Record<string, string> = {};
            for (const declaration of body.split(";")) {
                const colon = declaration.indexOf(":");
                if (colon !== -1) declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
            }
            rules.push({ selector, media, declarations });
        }
        cursor = end;
    }
    return rules;
};

const inspectStyles = (html: string) => {
    const classes = html.match(/<button[^>]*class="([^"]+)"/)?.[1].split(" ");
    const root = classes?.find(value => value.startsWith("css-"));
    assert.ok(root, "実際のbuttonに付いたEmotionクラスを使う");
    const rules = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].flatMap(match => extractRules(match[1]));
    // 同じ条件・セレクタの宣言は出力順で上書きし、MUI既定値より後の共通設定を検証する。
    const declarations = (suffix = "", media: string[] = []) => Object.assign({}, ...rules
        .filter(rule => rule.selector === `.${root}${suffix}` && JSON.stringify(rule.media) === JSON.stringify(media))
        .map(rule => rule.declarations)) as Record<string, string>;
    return { root: `.${root}`, rules, declarations };
};

test("既定値はprimary/contained/mdのbuttonでラベルをエスケープする", () => {
    const html = render({ label: "作成<&" });
    assert.match(html, /type="button"/);
    assert.match(html, /MuiButton-contained/);
    const { declarations } = inspectStyles(html);
    assert.equal(declarations()["background-color"], "#1976D2");
    assert.equal(declarations("", ["(min-width:0px)"])["min-height"], "52px");
    assert.equal(declarations("", ["(min-width:600px)"])["min-height"], "36px");
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
            for (const disabled of [false, true]) {
                const html = render({ label: "実行", variant, appearance, disabled });
                const { root, rules, declarations } = inspectStyles(html);
                assert.equal(declarations().color, appearance === "contained" ? "#FFFFFF" : base);
                assert.equal(declarations()["background-color"], appearance === "contained" ? base : "transparent");
                assert.equal(declarations().border, appearance === "outlined" ? `1px solid ${base}` : "1px solid transparent");
                assert.equal(declarations(":hover")["background-color"], appearance === "contained" ? hover : light);
                assert.equal(declarations(":active")["background-color"], appearance === "contained" ? active : pressed);
                assert.equal(declarations(".Mui-focusVisible").outline, `2px solid ${base}`);
                assert.equal(declarations(".Mui-focusVisible")["outline-offset"], "2px");
                assert.equal(declarations(".Mui-disabled").color, "#6B7280");
                assert.equal(declarations(".Mui-disabled")["background-color"], appearance === "contained" ? "#E5E7EB" : "transparent");
                assert.equal(declarations(".Mui-disabled")["border-color"], appearance === "outlined" ? "#D1D5DB" : "transparent");
                assert.equal(declarations(".Mui-disabled")["pointer-events"], "none");
                // これらは同じ詳細度。disabledの最終色指定がhover/activeより後にあることを確認する。
                const lastBackground = (suffix: string) => rules.findLastIndex(rule => rule.selector === `${root}${suffix}` && rule.media.length === 0 && "background-color" in rule.declarations);
                assert.ok(lastBackground(".Mui-disabled") > lastBackground(":hover"));
                assert.ok(lastBackground(".Mui-disabled") > lastBackground(":active"));
                assert.equal(/<button[^>]* disabled=""/.test(html), disabled);
                assert.equal(/<button[^>]*class="[^"]*Mui-disabled/.test(html), disabled);
            }
        }
    }
});

test("全5段階で600px境界の寸法と文字・アイコン寸法を出力する", () => {
    for (const [size, mobileHeight, desktopHeight, mobilePadding, desktopPadding, mobileFont, desktopFont, mobileIcon, desktopIcon] of [
        ["xs", 44, 28, 12, 8, 13, 12, 13, 12],
        ["sm", 48, 32, 16, 12, 14, 13, 14, 13],
        ["md", 52, 36, 20, 16, 15, 14, 15, 14],
        ["lg", 56, 40, 24, 20, 16, 15, 16, 15],
        ["xl", 60, 44, 28, 24, 17, 16, 17, 16],
    ] as const) {
        const html = render({ label: "サイズ", size });
        const { declarations } = inspectStyles(html);
        for (const [media, height, padding, font, icon, paddingY] of [
            ["(min-width:0px)", mobileHeight, mobilePadding, mobileFont, mobileIcon, 6],
            ["(min-width:600px)", desktopHeight, desktopPadding, desktopFont, desktopIcon, 4],
        ] as const) {
            const root = declarations("", [media]);
            assert.equal(root["min-height"], `${height}px`, `${size} ${media}`);
            assert.equal(root["padding-left"], `${padding}px`);
            assert.equal(root["padding-right"], `${padding}px`);
            assert.equal(root["padding-top"], `${paddingY}px`);
            assert.equal(root["padding-bottom"], `${paddingY}px`);
            assert.equal(root["font-size"], `${font / 16}rem`);
            const iconStyles = declarations(" .CHButton-icon", [media]);
            for (const property of ["width", "height", "font-size"]) assert.equal(iconStyles[property], `${icon}px`);
        }
    }
});

test("アイコンは装飾としてラベルと並び、長文の折返しと高さ拡張を許可する", () => {
    const label = "長いラベル".repeat(30);
    const html = render({ label, startIcon: createElement("svg", { "data-testid": "icon" }) });
    assert.match(html, /class="CHButton-icon" aria-hidden="true"><svg/);
    assert.ok(html.indexOf('data-testid="icon"') < html.indexOf(label));
    const { root, rules, declarations } = inspectStyles(html);
    for (const [property, value] of Object.entries({ gap: "2px", "justify-content": "center", "align-items": "center", "min-width": "0", "white-space": "normal", "overflow-wrap": "anywhere", "max-width": "100%", "text-transform": "none", "border-radius": "8px", width: "auto" })) {
        assert.equal(declarations()[property], value, property);
    }
    assert.equal(declarations(" .CHButton-label")["min-width"], "0");
    assert.equal(declarations(" .CHButton-icon")["flex-shrink"], "0");
    assert.equal(declarations(" .CHButton-icon>*").width, "100%!important");
    for (const rule of rules.filter(rule => rule.selector === root)) {
        assert.equal(rule.declarations.height, undefined, "ルートの高さを固定しない");
        if (rule.declarations.width != null) assert.equal(rule.declarations.width, "auto");
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
