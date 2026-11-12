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

const BlockWidthField: FC<BlockWidthFieldProps> = ({ value, onChange, style, label, helperText, error}) => {

    const {
        slotMinutes,
    } = useContext(TimeTableConfigure);

    const handleChange = (value: number | null) => {
        onChange?.(value ?? NaN);
    };

    return (
        <>
            <NumberField
                min={slotMinutes}
                max={24 * 60}
                step={slotMinutes}
                allowOutOfRange={true}
                error={error}
                value={value !== undefined && Number.isFinite(value) ? value : null}
                onValueChange={handleChange}
                style={style}
                label={label}
                helperText={helperText}
            />
        </>
    )
};

export default BlockWidthField;