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

type SizeDimensions = {
    minHeight: number;
    paddingInline: number;
    fontSize: number;
    iconSize: number;
};

type ResponsiveDimensions = {
    mobile: SizeDimensions;
    desktop: SizeDimensions;
};

type ButtonPalette = {
    base: string;
    hover: string;
    active: string;
    light: string;
    pressed: string;
};

// MUIのxs/smブレークポイントでモバイル/デスクトップの寸法を切り替える。
const SIZES = {
    xs: {
        mobile: { minHeight: 44, paddingInline: 12, fontSize: 13, iconSize: 9 },
        desktop: { minHeight: 28, paddingInline: 8, fontSize: 12, iconSize: 8 },
    },
    sm: {
        mobile: { minHeight: 48, paddingInline: 16, fontSize: 14, iconSize: 10 },
        desktop: { minHeight: 32, paddingInline: 12, fontSize: 13, iconSize: 9 },
    },
    md: {
        mobile: { minHeight: 52, paddingInline: 20, fontSize: 15, iconSize: 11 },
        desktop: { minHeight: 36, paddingInline: 16, fontSize: 14, iconSize: 10 },
    },
    lg: {
        mobile: { minHeight: 56, paddingInline: 24, fontSize: 16, iconSize: 12 },
        desktop: { minHeight: 40, paddingInline: 20, fontSize: 15, iconSize: 11 },
    },
    xl: {
        mobile: { minHeight: 60, paddingInline: 28, fontSize: 17, iconSize: 13 },
        desktop: { minHeight: 44, paddingInline: 24, fontSize: 16, iconSize: 12 },
    },
} satisfies Record<ButtonSize, ResponsiveDimensions>;

const COLORS = {
    primary: { base: "#1976D2", hover: "#1565C0", active: "#0D47A1", light: "#E3F2FD", pressed: "#BBDEFB" },
    secondary: { base: "#475569", hover: "#334155", active: "#1E293B", light: "#F1F5F9", pressed: "#E2E8F0" },
    danger: { base: "#D32F2F", hover: "#C62828", active: "#B71C1C", light: "#FFEBEE", pressed: "#FFCDD2" },
} satisfies Record<ButtonVariant, ButtonPalette>;

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
    const iconSize = { xs: `${dimensions.mobile.iconSize}px`, sm: `${dimensions.desktop.iconSize}px` };

    return (
        <Button
            type={type}
            disabled={disabled}
            onClick={onClick}
            variant={appearance}
            disableElevation
            disableRipple
            sx={{
                minHeight: { xs: `${dimensions.mobile.minHeight}px`, sm: `${dimensions.desktop.minHeight}px` },
                paddingX: { xs: `${dimensions.mobile.paddingInline}px`, sm: `${dimensions.desktop.paddingInline}px` },
                paddingY: { xs: "6px", sm: "4px" },
                fontSize: { xs: `${dimensions.mobile.fontSize / 16}rem`, sm: `${dimensions.desktop.fontSize / 16}rem` },
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
