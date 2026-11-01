import { Stack, TextField } from "@mui/material";
import type { FC } from "react";


type MemoProps = {
    memo: string,
    onChange: (memo: string) => void
}

const Memo: FC<MemoProps> = ({ memo, onChange }) => {
    return (
        <>
            <Stack direction={"column"}>
                <label>メモ</label>
                <TextField
                    multiline
                    rows={4}
                    value={memo}
                    onChange={(e) => onChange(e.target.value)}
                />
            </Stack>
        </>
    );
};

export default Memo;