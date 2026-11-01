import { useContext, type FC } from "react";
import NumberField from "./NumberField";
import TimeTableConfigure from "@/feature/timeblocking/contexts/TimeTableConfigure";

type BlockWidthFieldProps = {
    value?: number,
    onChange?: (value: number) => void,
    style?: React.CSSProperties,
    label?: React.ReactNode,
    error?: boolean,
    helperText?: React.ReactNode,
};

const BlockWidthField: FC<BlockWidthFieldProps> = ({ value, onChange, style, label, helperText}) => {

    const {
        slotMinutes,
    } = useContext(TimeTableConfigure);

    const handleChange = (value: number | null) => {
        if (value !== null) {
            onChange?.(value);
        };
    };

    return (
        <>
            <NumberField
                min={slotMinutes}
                max={24 * 60}
                step={slotMinutes}
                allowOutOfRange={false}
                value={value}
                onValueChange={handleChange}
                style={style}
                label={label}
                helperText={helperText}
            />
        </>
    )
};

export default BlockWidthField;