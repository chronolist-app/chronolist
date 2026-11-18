import TextField from "@mui/material/TextField";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

/** 入力要素の標準属性と、アプリ共通のラベル・状態・寸法を指定する。 */
export type CHTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, "size" | "children" | "onAnimationStart" | "aria-invalid"> & {
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
    id, required, disabled, readOnly, type, value, defaultValue, onChange, onBlur, onFocus,
    "aria-describedby": describedBy, ...inputAttributes
}: CHTextFieldProps) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helper = typeof helperText === "number" || typeof helperText === "bigint" ? String(helperText) : helperText;
    const hasHelper = Boolean(helper);
    const description = [describedBy, hasHelper ? `${inputId}-helper-text` : undefined].filter(Boolean).join(" ") || undefined;
    // JavaScriptなど型検査を通らない呼出元からも、MUI内部管理の属性を受け渡さない。
    const nativeAttributes = { ...inputAttributes };
    Reflect.deleteProperty(nativeAttributes, "onAnimationStart");
    Reflect.deleteProperty(nativeAttributes, "aria-invalid");
    const nativeDateTime = !multiline && type !== undefined && ["date", "time", "datetime-local", "month", "week"].includes(type);

    return <TextField
        id={inputId}
        label={label}
        helperText={helper}
        error={error}
        required={required}
        disabled={disabled}
        type={type}
        size={size}
        fullWidth={fullWidth}
        multiline={multiline}
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        slotProps={{
            input: { readOnly },
            inputLabel: nativeDateTime ? { shrink: true } : undefined,
            htmlInput: { ...nativeAttributes, "aria-describedby": description },
        }}
    />;
};

export default CHTextField;
