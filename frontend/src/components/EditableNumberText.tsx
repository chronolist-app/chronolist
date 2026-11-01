import { Input, Typography, type SxProps, type TypographyVariant } from "@mui/material";
import { useEffect, useState, type FC } from "react";


type EditableNumberTextProps = {
    value?: number,
    onChange?: (value: number) => void,
    sx?: SxProps,
    variant?: TypographyVariant,
};

const EditableNumberText: FC<EditableNumberTextProps> = ({ value, onChange, sx, variant }) => {
    
    const [ isEditing, setIsEditing ] = useState(false);
    const [ number, setNumber ] = useState<number>(value || 0);

    useEffect(() => {
        setNumber(value || 0);
    }, [value]);

    const handleFinishEdit = () => {
        onChange?.(number);
        setIsEditing(false);
    };
    const handleKeyDown = (event: React.KeyboardEvent) => {
        const cancelKeys = ["Escape", "Enter"];
        if (cancelKeys.includes(event.key)) handleFinishEdit();
    };

    const textNode = (
        <Typography
            variant={variant}
            onDoubleClick={() => setIsEditing(true)}
            sx={sx}
        >{number}</Typography>
    );
    const editNode = (
        <Input
            value={number}
            autoFocus
            type="number"
            onChange={(e) => setNumber(Number(e.target.value))}
            onKeyDown={(e) => {handleKeyDown(e);}}
            onBlur={handleFinishEdit}
            sx={sx}
        />
    );

    return isEditing ? editNode : textNode;
};

export default EditableNumberText;