import { Box } from "@mui/material";
import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => (
  <Box minHeight="100vh" display="flex" bgcolor="background.default">
    <Sidebar />
    <Box component="main" flex={1} minWidth={0} bgcolor="background.default">
      {children}
    </Box>
  </Box>
);

export default AppShell;
