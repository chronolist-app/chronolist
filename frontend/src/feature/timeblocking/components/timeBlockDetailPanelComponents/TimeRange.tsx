import EditableTimeText from "@/components/EditableTimeText";
import { Time } from "@/utils/time";
import { Divider, Stack, Typography, type SxProps } from "@mui/material";
import { useCallback, useEffect, useState, type FC } from "react";


type TimeRangeProps = {
    width?: number,
    startAt?: Time,
    setStartAt: (startAt: Time) => void
};

const textSx: SxProps = {
    fontSize: "2rem",
};
const labelSx: SxProps = {
    fontSize: "1.3rem",
}

/**
 * 開始日時と終了日時を表示するコンポーネント
 */
const TimeRange: FC<TimeRangeProps> = ({ width = 0, startAt = new Time(), setStartAt }) => {
    const [ endAt, setEndAt ] = useState(startAt.add(width));

    useEffect(() => {
        setEndAt(startAt.add(width));
    }, [width, startAt]);

    /**
     * 開始日時を変更したときの処理.  
     */
    const handleSetStartAt = useCallback((startAt: Time) => {
        setStartAt(startAt);
        setEndAt(startAt.add(width));
    }, [width, setStartAt, setEndAt]);

    /**
     * 終了日時を変更したときの処理.  
     * 保守性を考慮して開始日時を変更する関数を呼び出す.
     */
    const handleSetEndAt = useCallback((endAt: Time) => {
        handleSetStartAt(endAt.subtract(width));
    }, [width, handleSetStartAt]);

            
    return (
        <>
            <Stack>
                <Divider orientation={"horizontal"} textAlign="left" flexItem>時刻</Divider>
                <Stack spacing={3} direction={"row"}>
                    <Stack>
                        <Typography sx={labelSx}>From</Typography>
                        <EditableTimeText sx={textSx} value={startAt} onChange={handleSetStartAt} />
                    </Stack>
                    <Stack>
                        <Typography sx={labelSx}>To</Typography>
                        <EditableTimeText sx={textSx} value={endAt} onChange={handleSetEndAt} />
                    </Stack>
                </Stack>
            </Stack>
        </>
    );
};

export default TimeRange;