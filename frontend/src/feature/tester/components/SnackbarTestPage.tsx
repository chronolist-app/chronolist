import { useSnackbar, type VariantType } from "notistack";
import { useState } from "react";
import { Button } from "react-bootstrap";

import { actionSnackbarOptions } from "@/components/snackbar-action-options";

const VARIANTS: { variant: VariantType, label: string }[] = [
    { variant: "default", label: "通常" },
    { variant: "success", label: "成功" },
    { variant: "info", label: "情報" },
    { variant: "warning", label: "警告" },
    { variant: "error", label: "エラー" },
];

/** Snackbar 共通基盤の動作確認ページ。 */
const SnackbarTestPage = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [actionCount, setActionCount] = useState(0);
    const [serial, setSerial] = useState(0);

    const enqueueMany = (count: number) => {
        for (let i = 1; i <= count; i++) enqueueSnackbar(`連続通知 ${serial + i}`, { variant: "info" });
        setSerial(serial + count);
    };

    return (
        <>
            <h1>Snackbar</h1>
            <div>
                {VARIANTS.map(({ variant, label }) => (
                    <Button key={variant} className="m-2"
                        onClick={() => enqueueSnackbar(`${label}の通知`, { variant })}>{label}</Button>
                ))}
            </div>
            <div>
                <Button className="m-2" onClick={() => enqueueSnackbar("アクション付きの通知", {
                    variant: "info",
                    ...actionSnackbarOptions("実行", () => setActionCount(count => count + 1)),
                })}>アクション付き</Button>
                <span role="status" data-testid="action-count">アクション実行回数: {actionCount}</span>
            </div>
            <div>
                <Button className="m-2" onClick={() => enqueueSnackbar("同一メッセージの通知", { variant: "info" })}>同一メッセージ</Button>
                <Button className="m-2" onClick={() => enqueueMany(6)}>6件連続追加</Button>
            </div>
        </>
    );
};

export default SnackbarTestPage;
