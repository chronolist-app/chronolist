import { Typography, type TypographyVariant, Input, type SxProps } from "@mui/material";
import { useEffect, useState, type FC } from "react";


type EditableTextProps = {
    value?: string,
    variant?: TypographyVariant | "inherit",
    style?: React.CSSProperties,
    sx?: SxProps,
    onChange?: (value: string) => void,
};

const EditableText: FC<EditableTextProps> = ({ value, variant, style, sx, onChange }) => {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ text, setText ] = useState<string>(value || "");

    useEffect(() => {
        setText(value || "");
    }, [value]);

    const handleFinishEdit = () => {
        onChange?.(text.trim());
        setIsEditing(false);
    };
    const handleKeyDown = (event: React.KeyboardEvent) => {
        const cancelKeys = ["Escape", "Enter"];
        if (cancelKeys.includes(event.key)) handleFinishEdit();
    };

    const textNode = (
        <Typography
            style={style}
            variant={variant}
            onDoubleClick={() => setIsEditing(true)}
            sx={sx}
        >{text}</Typography>
    );
    const editNode = (
        <Input
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {handleKeyDown(e);}}
            onBlur={handleFinishEdit}
            sx={sx}
            style={style}
        />
    );

    return (
        <>
            {isEditing ? editNode : textNode}
        </>
    )
};

export default EditableText;