import { useContext } from "react";
import TimeTableConfigure from "../../contexts/TimeTableConfigure";
import { Divider, Stack, TextField } from "@mui/material";
import { useEffect, useState, type FC } from "react";
import { isValidUiBlockWidth } from "../../utils/blockValidation";
type WidthProps = { width: number; setWidth: (width: number) => void };
const Width: FC<WidthProps> = ({ width, setWidth }) => {
    const { slotMinutes } = useContext(TimeTableConfigure);
    const [draft, setDraft] = useState(String(width));
    const [error, setError] = useState(false);
    useEffect(() => {
        setDraft(String(width));
        setError(false);
    }, [width]);
    const finish = () => {
        const next = draft.trim() === "" ? NaN : Number(draft);
        if (!isValidUiBlockWidth(next, slotMinutes)) {
            setError(true);
            return;
        }
        setError(false);
        setWidth(next);
        setDraft(String(width));
    };
    return (
        <Stack>
            <Divider textAlign="left">ブロック幅</Divider>
            <TextField
                label="幅（分）"
                type="number"
                value={draft}
                error={error}
                helperText={error ? "幅は1〜1440分でスロットの倍数にしてください。" : undefined}
                onChange={event => setDraft(event.target.value)}
                onBlur={finish}
                onKeyDown={event => {
                    if (event.key === "Enter") event.currentTarget.querySelector("input")?.blur();
                }}
                slotProps={{ htmlInput: { min: 1, max: 1440, step: slotMinutes } }}
            />
        </Stack>
    );
};
export default Width;
