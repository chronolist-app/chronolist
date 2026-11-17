import { Button } from "@mui/material";
import type { OptionsObject, SnackbarKey } from "notistack";

import { SNACKBAR_ACTION_AUTO_HIDE_MS } from "@/config/snackbar";
import SnackbarCloseButton from "./SnackbarCloseButton";

/**
 * アクションボタン付き通知用の enqueueSnackbar オプションを返す。
 * notistack は enqueue 時の action が Provider の action を上書きするため、
 * ×ボタンを含めた action と、アクション付き通知の表示時間をここで一括して付与する。
 * 業務処理は onClick（呼び出し元）の責務で、クリック後も通知は自動では閉じない。
 *
 * 使用例: enqueueSnackbar("削除しました", { ...actionSnackbarOptions("元に戻す", undo) })
 */
export const actionSnackbarOptions = (
    label: string,
    onClick: (key: SnackbarKey) => void,
): Pick<OptionsObject, "action" | "autoHideDuration"> => ({
    autoHideDuration: SNACKBAR_ACTION_AUTO_HIDE_MS,
    action: key => (
        <>
            <Button size="small" color="inherit" onClick={() => onClick(key)}>{label}</Button>
            <SnackbarCloseButton snackbarKey={key} />
        </>
    ),
});
