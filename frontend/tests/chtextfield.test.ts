import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { CHTextFieldProps } from "../src/components/CHTextField.tsx";

const DIRECTORY = await mkdtemp(fileURLToPath(new URL(".chtextfield-", import.meta.url)));
after(() => rm(DIRECTORY, { recursive: true, force: true }));
const SOURCE = await readFile(new URL("../src/components/CHTextField.tsx", import.meta.url), "utf8");
const MODULE_PATH = `${DIRECTORY}/CHTextField.mjs`;
await writeFile(MODULE_PATH, ts.transpileModule(SOURCE, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { default: CHTextField } = await import(pathToFileURL(MODULE_PATH).href);
const render = (props: CHTextFieldProps) => renderToStaticMarkup(createElement(CHTextField, props));
const inputTag = (html: string) => {
    const tag = html.match(/<input\b[^>]*>/)?.[0];
    assert.ok(tag);
    return tag;
};

test("ラベルと補助文が明示IDに紐づき、エラーが入力に伝わる", () => {
    const html = render({ id: "title", label: "タイトル", helperText: "入力してください", error: true });
    assert.match(html, /<label[^>]*for="title"/);
    assert.match(html, /<p[^>]*id="title-helper-text"[^>]*>入力してください<\/p>/);
    assert.match(inputTag(html), /aria-describedby="title-helper-text"/);
    assert.match(inputTag(html), /aria-invalid="true"/);
});

test("数値0の補助文も表示し、説明先のDOMが存在する", () => {
    const html = render({ id: "zero", label: "ゼロ", helperText: 0 });
    assert.match(inputTag(html), /aria-describedby="zero-helper-text"/);
    assert.match(html, /<p[^>]*id="zero-helper-text"[^>]*>0<\/p>/);
});

test("省略したIDはインスタンスごとに一意で、外部説明も保持する", () => {
    const html = renderToStaticMarkup(createElement("div", null,
        createElement(CHTextField, { label: "一つ目", helperText: "補助", "aria-describedby": "external" }),
        createElement(CHTextField, { label: "二つ目" })));
    const ids = [...html.matchAll(/<input\b[^>]*id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
    for (const id of ids) assert.ok(html.includes(`for="${id}"`));
    assert.ok(inputTag(html).includes(`aria-describedby="external ${ids[0]}-helper-text"`));
});

test("標準属性はinputへ渡り、passwordと制約・必須・無効・readOnlyを保持する", () => {
    const tag = inputTag(render({ label: "秘密", type: "password", name: "password", defaultValue: "abc", required: true,
        disabled: true, readOnly: true, autoComplete: "new-password", placeholder: "入力", maxLength: 64,
        pattern: "[a-z]+", "aria-label": "秘密の入力", tabIndex: 2 }));
    for (const attribute of ['type="password"', 'name="password"', 'value="abc"', 'required=""', 'disabled=""',
        'readOnly=""', 'autoComplete="new-password"', 'placeholder="入力"', 'maxLength="64"', 'pattern="[a-z]+"', 'aria-label="秘密の入力"', 'tabindex="2"']) assert.ok(tag.includes(attribute), attribute);
    const number = inputTag(render({ type: "number", min: 1, max: 10, step: 0.5 }));
    for (const attribute of ['min="1"', 'max="10"', 'step="0.5"']) assert.ok(number.includes(attribute));
});

test("multilineはrows付きtextareaへ標準属性を渡す", () => {
    const html = render({ label: "メモ", multiline: true, rows: 3, defaultValue: "内容", readOnly: true, maxLength: 100 });
    assert.match(html, /<textarea[^>]*rows="3"[^>]*>内容<\/textarea>/);
    assert.match(html, /<textarea[^>]*readOnly=""/);
    assert.match(html, /<textarea[^>]*maxLength="100"/);
    assert.doesNotMatch(html, /<input\b/);
});

test("両サイズとfullWidthを指定でき、省略時はTheme既定値を優先する", () => {
    assert.match(render({ size: "small", fullWidth: true }), /MuiInputBase-sizeSmall/);
    assert.doesNotMatch(render({ size: "medium" }), /MuiInputBase-sizeSmall/);
    assert.match(render({ fullWidth: true }), /MuiFormControl-fullWidth/);
    const theme = createTheme({ components: { MuiTextField: { defaultProps: { size: "small", variant: "filled" } } } });
    const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(CHTextField, { label: "テーマ" })));
    assert.match(html, /MuiInputBase-sizeSmall/);
    assert.match(html, /MuiFilledInput-root/);
});

test("公開PropsはReact標準イベントを受け付け、MUI固有Propsを拒否する", async () => {
    const fixture = `${DIRECTORY}/props.tsx`;
    await writeFile(fixture, `import CHTextField from "../../src/components/CHTextField.tsx";
const input = <CHTextField label="入力" value="値" onChange={e => { const value: string = e.target.value; void value; }} onBlur={e => { e.currentTarget.focus(); }} onKeyDown={e => { const key: string = e.key; void key; }} />;
const area = <CHTextField multiline rows={3} onChange={e => { const value: string = e.target.value; void value; }} />;
// @ts-expect-error MUIのsxは公開しない
const sx = <CHTextField sx={{ color: "red" }} />;
// @ts-expect-error MUIのslotPropsは公開しない
const slots = <CHTextField slotProps={{ htmlInput: {} }} />;
// @ts-expect-error HTMLの文字幅sizeは使わない
const size = <CHTextField size={20} />;
void [input, area, sx, slots, size];`);
    const program = ts.createProgram([fixture], { noEmit: true, strict: true, skipLibCheck: true,
        jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022, allowImportingTsExtensions: true, esModuleInterop: true });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: name => name, getCurrentDirectory: () => DIRECTORY, getNewLine: () => "\n",
    }));
});
