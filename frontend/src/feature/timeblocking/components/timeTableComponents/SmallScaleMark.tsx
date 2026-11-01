import { Typography } from "@mui/material";
import { useContext, type FC } from "react";

import TimeTableConfigure from "../../contexts/TimeTableConfigure";

/**
 * 小刻み目盛りを描画するコンポーネント.  
 * 
 * 時間表の小刻み目盛りを描画する.  
 * {@link HourScaleMark} よりも小さい目盛りを描画する.  
 */
const SmallScaleMark: FC<{label: string}> = ({label}) => {

    const { gridSize, slotHeight } = useContext(TimeTableConfigure);

    return (
        <>
            <Typography
                variant="caption"
                sx={{
                    borderTop: gridSize,
                    height: slotHeight,
                }}>
                    {label}
                </Typography>
        </>
    );
}

export default SmallScaleMark;
