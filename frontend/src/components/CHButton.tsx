import Button from "@mui/material/Button";
import type { MouseEventHandler, ReactNode } from "react";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonAppearance = "contained" | "outlined" | "text";

export type CHButtonProps = {
    label: string;
    size?: ButtonSize;
    variant?: ButtonVariant;
    appearance?: ButtonAppearance;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    startIcon?: ReactNode;
};

// MUIのxs/smブレークポイントでモバイル/デスクトップの寸法を切り替える。
const SIZES = {
    xs: { height: [44, 28], padding: [12, 8], font: [13, 12], icon: [9, 8] },
    sm: { height: [48, 32], padding: [16, 12], font: [14, 13], icon: [10, 9] },
    md: { height: [52, 36], padding: [20, 16], font: [15, 14], icon: [11, 10] },
    lg: { height: [56, 40], padding: [24, 20], font: [16, 15], icon: [12, 11] },
    xl: { height: [60, 44], padding: [28, 24], font: [17, 16], icon: [13, 12] },
} satisfies Record<ButtonSize, Record<string, [number, number]>>;

const COLORS = {
    primary: { base: "#1976D2", hover: "#1565C0", active: "#0D47A1", light: "#E3F2FD", pressed: "#BBDEFB" },
    secondary: { base: "#475569", hover: "#334155", active: "#1E293B", light: "#F1F5F9", pressed: "#E2E8F0" },
    danger: { base: "#D32F2F", hover: "#C62828", active: "#B71C1C", light: "#FFEBEE", pressed: "#FFCDD2" },
} satisfies Record<ButtonVariant, Record<string, string>>;

/** アプリ共通のサイズ・状態色でラベル付きボタンを表示する。 */
const CHButton = ({
    label,
    size = "md",
    variant = "primary",
    appearance = "contained",
    type = "button",
    disabled = false,
    onClick,
    startIcon,
}: CHButtonProps) => {
    const dimensions = SIZES[size];
    const palette = COLORS[variant];
    const contained = appearance === "contained";
    const outlined = appearance === "outlined";
    const hasStartIcon = startIcon != null && typeof startIcon !== "boolean" && startIcon !== "";
    const iconSize = { xs: `${dimensions.icon[0]}px`, sm: `${dimensions.icon[1]}px` };

    return (
        <Button
            type={type}
            disabled={disabled}
            onClick={onClick}
            variant={appearance}
            disableElevation
            disableRipple
            sx={{
                minHeight: { xs: `${dimensions.height[0]}px`, sm: `${dimensions.height[1]}px` },
                paddingX: { xs: `${dimensions.padding[0]}px`, sm: `${dimensions.padding[1]}px` },
                paddingY: { xs: "6px", sm: "4px" },
                fontSize: { xs: `${dimensions.font[0] / 16}rem`, sm: `${dimensions.font[1] / 16}rem` },
                fontWeight: 500,
                lineHeight: 1.5,
                textTransform: "none",
                borderRadius: "8px",
                boxShadow: "none",
                width: "auto",
                minWidth: 0,
                maxWidth: "100%",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "2px",
                color: contained ? "#FFFFFF" : palette.base,
                backgroundColor: contained ? palette.base : "transparent",
                border: outlined ? `1px solid ${palette.base}` : "1px solid transparent",
                "&:hover": {
                    backgroundColor: contained ? palette.hover : palette.light,
                    boxShadow: "none",
                },
                "&:active": {
                    backgroundColor: contained ? palette.active : palette.pressed,
                    boxShadow: "none",
                },
                "&.Mui-focusVisible": {
                    outline: `2px solid ${palette.base}`,
                    outlineOffset: "2px",
                },
                "&.Mui-disabled": {
                    color: "#6B7280",
                    backgroundColor: contained ? "#E5E7EB" : "transparent",
                    borderColor: outlined ? "#D1D5DB" : "transparent",
                },
                "& .CHButton-icon": {
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    width: iconSize,
                    height: iconSize,
                    fontSize: iconSize,
                    // MUIアイコンや呼出元のインライン寸法も共通サイズに揃える。
                    "& > *": { width: "100% !important", height: "100% !important", fontSize: "inherit" },
                },
                "& .CHButton-label": { minWidth: 0 },
            }}
        >
            {hasStartIcon && <span className="CHButton-icon" aria-hidden="true">{startIcon}</span>}
            <span className="CHButton-label">{label}</span>
        </Button>
    );
};

export default CHButton;
