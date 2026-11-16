import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import type { RegionLoadStatus } from "../types/regionLoadTypes";

/** 領域ごとの取得状況と再試行操作を表示する。 */
const RegionLoadFeedback = ({ status, label, onRetry }: {
    status: RegionLoadStatus;
    label: string;
    onRetry: () => void;
}) => {
    if (status === "success") return null;
    if (status === "error") {
        return (
            <Alert severity="error" action={<Button color="inherit" onClick={onRetry}>再試行</Button>}>
                {label}を読み込めませんでした。
            </Alert>
        );
    }
    return (
        <Stack role="status" direction="row" spacing={1} alignItems="center" sx={{ p: 1 }}>
            <CircularProgress size={20} aria-hidden="true" />
            <Typography>{label}を読み込み中…</Typography>
        </Stack>
    );
};

export default RegionLoadFeedback;
