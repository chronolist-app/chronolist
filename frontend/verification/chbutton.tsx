import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { CircularProgress } from "@mui/material";
import CHButton from "../src/components/CHButton";
import type { ButtonAppearance, ButtonSize, ButtonVariant } from "../src/components/CHButton";

const SIZES: ButtonSize[] = ["xs", "sm", "md", "lg", "xl"];
const VARIANTS: ButtonVariant[] = ["primary", "secondary", "danger"];
const APPEARANCES: ButtonAppearance[] = ["contained", "outlined", "text"];

/** アプリ内リンクの遷移先と引き継いだstateを表示する。 */
const LinkVerification = () => {
    const location = useLocation();
    return <section>
        <h2>アプリ内リンク</h2>
        <CHButton label="スケジューラで編集" link={{ to: "/scheduler", state: { date: "2026-11-17", eventId: 177 } }} />
        <p aria-live="polite">遷移先: <output>{location.pathname}</output> / state: <output>{JSON.stringify(location.state)}</output></p>
    </section>;
};

/** 共通ボタンの見た目とネイティブ操作を開発時に確認する。 */
const Verification = () => {
    const [clicks, setClicks] = useState(0);
    const [submits, setSubmits] = useState(0);
    const [resets, setResets] = useState(0);
    const [enlarged, setEnlarged] = useState(false);
    const [disabledClicks, setDisabledClicks] = useState(0);

    return <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 1000 }}>
        <h1>CHButton 検証</h1>
        <p>幅600px未満でモバイル寸法。Tabでフォーカス、Space/Enterで操作、押下中の状態色を確認する。</p>
        <h2>5サイズ・アイコン</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {SIZES.map(size => <div key={size}><span>{size}: </span><CHButton size={size} label="削除" startIcon={<DeleteOutlineIcon />} /></div>)}
        </div>
        <h2>9組・disabled</h2>
        {VARIANTS.map(variant => <div key={variant} style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {APPEARANCES.map(appearance => <CHButton key={appearance} variant={variant} appearance={appearance} label={`${variant} ${appearance}`} />)}
            {APPEARANCES.map(appearance => <CHButton key={`${appearance}-disabled`} variant={variant} appearance={appearance} disabled label={`${appearance} disabled`} onClick={() => setDisabledClicks(value => value + 1)} />)}
        </div>)}
        <p>無効ボタンの実行回数: <output>{disabledClicks}</output></p>
        <h2>折返し・文字拡大・保存中表示</h2>
        <label><input type="checkbox" checked={enlarged} onChange={event => {
            setEnlarged(event.target.checked);
            document.documentElement.style.fontSize = event.target.checked ? "32px" : "16px";
        }} />文字を200%にする</label>
        <div style={{ width: 200, marginBlock: 16 }}><CHButton label="長いラベルでも全文を表示して高さを広げる abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" startIcon={<DeleteOutlineIcon />} /></div>
        <CHButton label="作成中…" disabled startIcon={<CircularProgress size={16} />} />
        <h2>クリック・submit・reset</h2>
        <form onSubmit={event => { event.preventDefault(); setSubmits(value => value + 1); }} onReset={() => setResets(value => value + 1)}>
            <input aria-label="リセット確認" defaultValue="初期値" />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                <CHButton label="クリック" onClick={() => setClicks(value => value + 1)} />
                <CHButton label="送信" type="submit" />
                <CHButton label="リセット" type="reset" />
            </div>
        </form>
        <p aria-live="polite">クリック: <output>{clicks}</output> / 送信: <output>{submits}</output> / リセット: <output>{resets}</output></p>
        <MemoryRouter initialEntries={["/timeblocking"]}><LinkVerification /></MemoryRouter>
    </main>;
};

export default Verification;

createRoot(document.getElementById("root")!).render(<Verification />);
