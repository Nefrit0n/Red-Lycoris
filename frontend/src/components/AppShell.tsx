import { Box } from "@mui/material";
import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import useCommandPalette from "../hooks/useCommandPalette";

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  const commandPalette = useCommandPalette();

  return (
    <Box minHeight="100vh" display="flex" bgcolor="background.default">
      <Sidebar onOpenCommandPalette={commandPalette.open} />
      <Box component="main" flex={1} minWidth={0} bgcolor="background.default">
        {children}
      </Box>
      <CommandPalette open={commandPalette.isOpen} onClose={commandPalette.close} />
    </Box>
  );
};

export default AppShell;
