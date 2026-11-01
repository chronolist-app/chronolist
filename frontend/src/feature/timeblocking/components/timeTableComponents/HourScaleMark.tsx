import { useContext, type FC } from "react";
import { Typography } from "@mui/material";

import TimeTableConfigure from "../../contexts/TimeTableConfigure";

/**
 * 一時間あたり目盛りを描画するコンポーネント.  
 */
const HourScaleMark: FC<{ label: string }> = ({ label }) => {

    const { gridSize, slotHeight } = useContext(TimeTableConfigure);

    return (
        <>
            <Typography
                variant="body2"
                sx={{
                    borderTop: gridSize,
                    height: slotHeight,
                }}>
                    {label}
            </Typography>
        </>
    );
};

export default HourScaleMark;