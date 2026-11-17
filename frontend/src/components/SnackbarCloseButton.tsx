import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";
import { closeSnackbar, type SnackbarKey } from "notistack";
import type { FC } from "react";

import { SNACKBAR_CLOSE_LABEL } from "@/config/snackbar";

type SnackbarCloseButtonProps = {
    snackbarKey: SnackbarKey,
};

/** 通知を手動で消去する×ボタン。Provider の既定 action とアクション付き通知の双方で使う。 */
const SnackbarCloseButton: FC<SnackbarCloseButtonProps> = ({ snackbarKey }) => (
    <IconButton size="small" color="inherit" aria-label={SNACKBAR_CLOSE_LABEL} onClick={() => closeSnackbar(snackbarKey)}>
        <CloseIcon fontSize="small" />
    </IconButton>
);

export default SnackbarCloseButton;
