import AppHeader from "@/components/AppHeader";
import { Divider, Stack, Box } from "@mui/material";

interface AppLayoutProps {
    children: React.ReactNode | React.ReactNode[];
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    return (
        <Stack direction="column" spacing={1} sx={{ height: "100vh" }}>
            <Box sx={{height: "15%"}}>
                <AppHeader />
            </Box>
            <Divider />
            {children}
        </Stack>
    );
};

export default AppLayout;