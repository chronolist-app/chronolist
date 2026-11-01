import { Time } from "@/utils/time";
import { Input, Typography, type SxProps, type TypographyVariant } from "@mui/material";
import { useCallback, useEffect, useState, type FC } from "react";


type EditableTimeTextProps = {
    value?: Time,
    variant?: TypographyVariant | "inherit"
    style?: React.CSSProperties
    sx?: SxProps
    onChange?: (value: Time) => void
};

/**
 * ダブルクリックで編集可能な時刻を表示するコンポーネント
 */
const EditableTimeText: FC<EditableTimeTextProps> = ({ value, variant, style, sx, onChange }) => {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ time, setTime ] = useState<Time>(value || new Time());

    // 外部から与えられた値が変更されたときも、内部の状態を更新
    useEffect(() => {
        setTime(value || new Time());
    }, [value]);

    const handleOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const result = e.target.value.trim();
        setTime(new Time(result));
    }, [setTime]);

    // 入力が確定されたときの処理
    const handleFinishEdit = useCallback(() => {
        onChange?.(time);
        setIsEditing(false);
    }, [time]);

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
        >{time.toString()}</Typography>
    );
    const editNode = (
        <Input
            value={time.toString()}
            autoFocus
            type={"time"}
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

export default EditableTimeText;