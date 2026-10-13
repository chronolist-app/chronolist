import AppHeader from "@/components/AppHeader";
import { Divider, Stack, Box } from "@mui/material";

interface AppLayoutProps {
    children: React.ReactNode | React.ReactNode[];
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    return (
        <Stack direction="column" spacing={1} sx={{ height: "100dvh" }}>
            <Box sx={{ height: "15%", flexShrink: 0 }}>
                <AppHeader />
            </Box>
            <Divider sx={{ flexShrink: 0 }} />
            <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
                {children}
            </Box>
        </Stack>
    );
};

export default AppLayout;
