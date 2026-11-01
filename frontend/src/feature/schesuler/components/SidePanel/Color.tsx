import PullDown from "@/components/pulldown"
import { Stack } from "@mui/material"
import type { FC } from "react"

type ColorProps = {
    color: string
    onChange: (color: string) => void
}

// 色の候補
// 将来的にはアプリケーション共通の候補を実装してそれを使用する
const colors: string[] = [
    "RED",
    "ORANGE",
    "YELLOW",
    "GREEN",
    "BLUE",
    "INDIGO",
    "VIOLET",
]

const Color: FC<ColorProps> = ({ color, onChange }) => {
    return (
        <>
            <Stack direction={"column"}>
                <label>カラー</label>
                <PullDown
                    items={colors}
                    onChange={onChange}
                    defaultValue={color}
                />
            </Stack>
        </>
    );
};

export default Color;