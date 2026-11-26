import { Stack } from "@mui/material";
import type { FC } from "react";
import CHTextField from "@/components/CHTextField";


type MemoProps = {
    memo: string,
    onChange: (memo: string) => void
}

const Memo: FC<MemoProps> = ({ memo, onChange }) => {
    return (
        <>
            <Stack direction={"column"}>
                <CHTextField
                    label="メモ"
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
