import EditableNumberText from "@/components/EditableNumberText";
import { Divider, Stack, Typography, type SxProps } from "@mui/material";
import type { FC } from "react";


type WidthProps = {
    width: number;
    setWidth: (width: number) => void;
};

const textSx: SxProps = {
    fontSize: "2rem",
};
const unitSx: SxProps = {
    fontSize: "1.5rem",
};

const Width: FC<WidthProps> = ({ width, setWidth }) => {
    
    return (
        <Stack>
            <Divider orientation={"horizontal"} textAlign="left" flexItem>ブロック幅</Divider>
            <Stack spacing={1} direction={"row"} alignItems={"end"}>
                <EditableNumberText value={width} onChange={setWidth} sx={textSx} />
                <Typography sx={unitSx}>min</Typography>
            </Stack>
        </Stack>
        
    );
};

export default Width;