import { SnackbarProvider } from "notistack";
import type { FC, ReactNode } from "react";

import {
    SNACKBAR_ANCHOR_ORIGIN,
    SNACKBAR_AUTO_HIDE_MS,
    SNACKBAR_MAX_COUNT,
    SNACKBAR_PREVENT_DUPLICATE,
} from "@/config/snackbar";
import SnackbarCloseButton from "./SnackbarCloseButton";

type AppSnackbarProviderProps = {
    children: ReactNode,
};

/**
 * 一時通知の表示と状態管理を集約する Provider。ルート付近に1つだけ置く。
 * 呼び出し元は notistack の useSnackbar() から enqueueSnackbar を直接使う。
 */
const AppSnackbarProvider: FC<AppSnackbarProviderProps> = ({ children }) => (
    <SnackbarProvider
        maxSnack={SNACKBAR_MAX_COUNT}
        anchorOrigin={SNACKBAR_ANCHOR_ORIGIN}
        autoHideDuration={SNACKBAR_AUTO_HIDE_MS}
        preventDuplicate={SNACKBAR_PREVENT_DUPLICATE}
        action={key => <SnackbarCloseButton snackbarKey={key} />}
    >
        {children}
    </SnackbarProvider>
);

export default AppSnackbarProvider;
