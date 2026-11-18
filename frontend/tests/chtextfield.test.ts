import test from "node:test";
import assert from "node:assert/strict";
import { loadTsx } from "./helpers/load-tsx.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { CHTextFieldProps } from "../src/components/CHTextField.tsx";

const { default: CHTextField } = await loadTsx<typeof import("../src/components/CHTextField.tsx")>(new URL("../src/components/CHTextField.tsx", import.meta.url));
const render = (props: CHTextFieldProps) => renderToStaticMarkup(createElement(CHTextField, props));
const inputTag = (html: string) => {
    const tag = html.match(/<input\b[^>]*>/)?.[0];
    assert.ok(tag);
    return tag;
};

test("空の日時入力はラベルを縮小し、multilineは対象外とする", () => {
    for (const type of ["date", "time", "datetime-local", "month", "week"]) {
        assert.match(render({ label: "日時", type, defaultValue: "" }), /data-shrink="true"/);
        assert.match(render({ label: "複数行", type, multiline: true }), /data-shrink="false"/);
    }
});

test("空文字IDを生成IDへ置き換え、ラベルと補助文を関連付ける", () => {
    const html = render({ id: "", label: "入力", helperText: "説明" });
    const id = inputTag(html).match(/\sid="([^"]+)"/)?.[1];
    assert.ok(id);
    assert.ok(html.includes(`for="${id}"`));
    assert.ok(html.includes(`id="${id}-helper-text"`));
    assert.ok(inputTag(html).includes(`aria-describedby="${id}-helper-text"`));
});

test("未サポートのaria-invalidがJavaScriptから渡されてもerrorを上書きしない", () => {
    const unsupported = { "aria-invalid": true };
    assert.match(inputTag(render({ ...unsupported, error: false })), /aria-invalid="false"/);
});

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

test("数値・bigintの補助文は文字列化し、空の補助文は説明先を作らない", () => {
    for (const helperText of [0, NaN, 12, 0n, 12n]) {
        const html = render({ id: "helper", helperText });
        assert.equal(html.match(/<p[^>]*id="helper-helper-text"[^>]*>(.*?)<\/p>/)?.[1], String(helperText));
        assert.match(inputTag(html), /aria-describedby="helper-helper-text"/);
    }
    for (const helperText of [false, null, undefined, ""]) {
        const html = render({ id: "empty", helperText });
        assert.doesNotMatch(inputTag(html), /aria-describedby/);
        assert.doesNotMatch(html, /id="empty-helper-text"/);
    }
});

test("readOnlyとsearchのMUI状態を反映し、textareaへtypeを漏らさない", () => {
    const html = render({ readOnly: true, type: "search" });
    assert.match(html, /MuiInputBase-readOnly/);
    assert.match(html, /MuiInputBase-inputTypeSearch/);
    assert.match(inputTag(html), /type="search"/);
    assert.match(inputTag(html), /readOnly=""/);
    const multiline = render({ multiline: true, rows: 2, type: "search", readOnly: true });
    assert.doesNotMatch(multiline.match(/<textarea\b[^>]*>/)?.[0] ?? "", /type=/);
    assert.match(multiline, /MuiInputBase-readOnly/);
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
