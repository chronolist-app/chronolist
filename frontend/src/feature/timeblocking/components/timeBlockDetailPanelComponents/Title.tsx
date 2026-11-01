import { type FC } from "react"
import EditableText from "@/components/EditableText";
import type { SxProps } from "@mui/material";

type TitleProps = {
    text?: string,
    setText?: (text: string) => void
}

const Title: FC<TitleProps> = ({ text, setText }) => {
    const sx: SxProps = {
        fontSize: "3rem",
        fontWeight: "bold",
    }
    return (
        <>
            <EditableText value={text} onChange={setText} sx={sx} />
        </>
    )
};

export default Title;