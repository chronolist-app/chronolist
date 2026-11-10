import { Box, Typography } from "@mui/material";
import { useContext } from "react";
import TimeTableConfigure from "../../contexts/TimeTableConfigure";

/**
 * 予定とタイムブロックに共通する時刻目盛りを描画する。
 */
const Legend = () => {
    const { gridSize, startTime, slotHeight, slotMinutes } = useContext(TimeTableConfigure);
    const slotCount = 24 * 60 / slotMinutes;

    return (
        <Box sx={{ gridArea: "legend", display: "grid", alignContent: "start", justifyItems: "end" }}>
            {Array.from({ length: slotCount + 1 }, (_, slot) => {
                const time = startTime.add(slot * slotMinutes);
                return (
                    <Typography
                        key={slot}
                        variant={time.minute === 0 ? "body2" : "caption"}
                        sx={{
                            gridArea: "1 / 1",
                            position: "relative",
                            top: slot * slotHeight,
                            borderTop: gridSize,
                        }}
                    >
                        {time.toString()}
                    </Typography>
                );
            })}
        </Box>
    );
};

export default Legend;
