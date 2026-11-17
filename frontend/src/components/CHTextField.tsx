import TextField from "@mui/material/TextField";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

/** 入力要素の標準属性と、アプリ共通のラベル・状態・寸法を指定する。 */
export type CHTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, "size" | "children"> & {
    label?: ReactNode;
    helperText?: ReactNode;
    error?: boolean;
    size?: "small" | "medium";
    fullWidth?: boolean;
    multiline?: boolean;
    rows?: number;
};

/** Themeの既定値を利用し、ラベルと補助文を入力に関連付ける共通入力欄。 */
const CHTextField = ({
    label, helperText, error, size, fullWidth, multiline, rows,
    id, required, disabled, value, defaultValue, onChange, onBlur, onFocus,
    "aria-describedby": describedBy, ...inputAttributes
}: CHTextFieldProps) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hasHelperText = helperText !== undefined && helperText !== null && helperText !== false && helperText !== "";
    const description = [describedBy, hasHelperText ? `${inputId}-helper-text` : undefined].filter(Boolean).join(" ") || undefined;

    return <TextField
        id={inputId}
        label={label}
        helperText={helperText === 0 ? "0" : helperText}
        error={error}
        required={required}
        disabled={disabled}
        size={size}
        fullWidth={fullWidth}
        multiline={multiline}
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        slotProps={{ htmlInput: { ...inputAttributes, "aria-describedby": description } }}
    />;
};

export default CHTextField;
