import { Box } from "@mui/material";

interface TabPanelProps {
  value: number;
  index: number;
  children: React.ReactNode;
}

/**
 * Simple tab panel component
 */
export const TabPanel = ({ value, index, children }: TabPanelProps) => {
  if (value !== index) return null;
  return <Box sx={{ mt: 2 }}>{children}</Box>;
};
