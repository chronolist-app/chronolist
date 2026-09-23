import { Input, Typography, type SxProps, type TypographyVariant } from "@mui/material";
import { useCallback, useEffect, useState, type FC } from "react";
import { fromDateString, toDateString } from "@/utils/date";


type EditableDateTextProps = {
    value?: Date,
    variant?: TypographyVariant | "inherit"
    style?: React.CSSProperties
    sx?: SxProps
    onChange?: (value: Date) => void
};

/**
 * ダブルクリックで編集可能な日付を表示するコンポーネント
 */
const EditableDateText: FC<EditableDateTextProps> = ({ value, variant, style, sx, onChange }) => {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ date, setDate ] = useState<Date>(value || new Date());

    // 外部から与えられた値が変更されたときも、内部の状態を更新
    useEffect(() => {
        setDate(value || new Date());
    }, [value]);

    const handleOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const result = e.target.value.trim();
        setDate(fromDateString(result));
    }, [setDate]);

    // 入力が確定されたときの処理
    const handleFinishEdit = useCallback(() => {
        onChange?.(date);
        setIsEditing(false);
    }, [date]);

    // 指定のキーが押されたときの処理
    // Enter か Esc が押されたら入力を確定
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        const cancelKeys = ["Escape", "Enter"];
        if (cancelKeys.includes(event.key)) handleFinishEdit();
    }, [handleFinishEdit]);

    const textNode = (
        <Typography
            style={style}
            variant={variant}
            onDoubleClick={() => setIsEditing(true)}
            sx={sx}
        >{date.toLocaleDateString()}</Typography>
    );
    const editNode = (
        <Input
            value={toDateString(date)}
            autoFocus
            type={"date"}
            onChange={handleOnChange}
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
    );
};

export default EditableDateText;