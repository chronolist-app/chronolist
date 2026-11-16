import { Time } from "@/utils/time";
import { Divider, Stack, TextField } from "@mui/material";
import { useEffect, useState, type FC } from "react";
import { getBlockValidationError } from "../../utils/blockValidation";
type TimeRangeProps = { width?: number; startAt?: Time; setStartAt: (start: Time) => void };
/** 24:00を扱えるテキスト入力で、終了の編集も開始時刻へ逆算する。 */
const TimeRange: FC<TimeRangeProps> = ({ width = 0, startAt = new Time(), setStartAt }) => {
    const [from, setFrom] = useState(startAt.toString());
    const [to, setTo] = useState(startAt.add(width).toString());
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        setFrom(startAt.toString());
        setTo(startAt.add(width).toString());
        setError(null);
    }, [startAt, width]);
    const finish = (end: boolean) => {
        const value = end ? to : from;
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && !(end && value === "24:00")) {
            setError("時刻をHH:mm形式で入力してください。終了は24:00も指定できます。");
            return;
        }
        const next = new Time(value).subtract(end ? width : 0);
        const message = getBlockValidationError({ status: "PLACED", width, startAt: next });
        setError(message);
        if (message) return;
        setStartAt(next);
    };
    return (
        <Stack>
            <Divider textAlign="left">時刻</Divider>
            <Stack spacing={3} direction="row">
                <TextField
                    label="From"
                    value={from}
                    error={!!error}
                    helperText={error}
                    onChange={e => setFrom(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") e.currentTarget.querySelector("input")?.blur();
                    }}
                    onBlur={() => finish(false)}
                />
                <TextField
                    label="To"
                    value={to}
                    error={!!error}
                    onChange={e => setTo(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") e.currentTarget.querySelector("input")?.blur();
                    }}
                    onBlur={() => finish(true)}
                />
            </Stack>
        </Stack>
    );
};
export default TimeRange;
