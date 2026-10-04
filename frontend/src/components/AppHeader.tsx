import { Box, Button, IconButton, Stack } from "@mui/material";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import notificationIcon from "@/assets/bell.png";
import settingsIcon from "@/assets/config.png";

const LogoButton: FC = () => {
    const nav = useNavigate();
    const handleClick = () => {
        const url = new URL(`${import.meta.env.VITE_API_BASE_URL}`);
        nav(url.pathname);
    };
    return (
        <IconButton sx={{ height: "100%", p: 0 }} onClick={handleClick}>
            <Box
                component="img"
                src={logo}
                alt="Logo"
                sx={{ height: "100%", width: "auto" }}
            />
        </IconButton>
    )
};

const AppButton: FC<{ app_name: string }> = ({ app_name }) => {
    const nav = useNavigate();
    const handleClick = () => {
        const url = new URL(`${import.meta.env.VITE_API_BASE_URL}/${app_name}`);
        nav(url.pathname);
    };
    return (
        <Button onClick={handleClick}>
            {app_name}
        </Button>
    );
};

const NotificationButton: FC = () => {
    return (
        <IconButton>
            <Box
                component="img"
                src={notificationIcon}
                alt="Notification"
                sx={{ height: "40%", width: "auto" }}
            />
        </IconButton>
    )
};

const SettingsButton: FC = () => {
    return (
        <IconButton>
            <Box
                component="img"
                src={settingsIcon}
                alt="Settings"
                sx={{ height: "40%", width: "auto" }}
            />
        </IconButton>
    )
};

const AppHeader: FC = () => {
    return (
        <Stack direction="row" spacing={2} alignItems="stretch" justifyContent="space-between" sx={{ height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="stretch" sx={{ height: "100%"}}>
                <LogoButton />
                <AppButton app_name="todolist" />
                <AppButton app_name="scheduler" />
                <AppButton app_name="timeblocking" />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="stretch" sx={{ height: "100%"}}>
                <NotificationButton />
                <SettingsButton />
            </Stack>
        </Stack>
    )
};

export default AppHeader;