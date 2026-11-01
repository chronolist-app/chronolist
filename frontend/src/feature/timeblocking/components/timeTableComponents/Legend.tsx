import { Stack } from "@mui/material";
import { useContext } from "react";
import TimeTableConfigure from "../../contexts/TimeTableConfigure";
import { Time } from "@/utils/time";
import HourScaleMark from "./HourScaleMark";
import SmallScaleMark from "./SmallScaleMark";

function* scaleRange(start: Time, end: Time, step: number) {
    for (let i = start.toMinutes(); i <= end.toMinutes(); i += step) {
        if (i % 60 === 0) {
            yield (<HourScaleMark key={i} label={new Time(i).toString()} />);
            continue;
        }
        yield (<SmallScaleMark key={i} label={new Time(i).toString()} />);
    }
}



/**
 * 時間表の小刻み目盛りの凡例を描画するコンポーネント.
 * 
 * 一時間単位の目盛りは {@link HourScaleMark} を使用して描画され,  
 * そうでないスロットごとの目盛りは {@link SmallScaleMark} を使用して描画される.
 */
const Legend = () => {

    const {
        startTime,
        slotMinutes,
    } = useContext(TimeTableConfigure);
    const endTime = startTime.add(24 * 60);

    return (
        <Stack alignItems={"flex-end"}>
            {Array.from(scaleRange(startTime, endTime, slotMinutes))}
        </Stack>
    )
}

export default Legend;