import { Box, Paper, Stack, Typography } from "@mui/material";

interface SectionProps {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}

/**
 * Reusable section component with title and optional right content
 */
export const Section = ({ title, right, children, dense }: SectionProps) => (
  <Paper
    variant="outlined"
    sx={{
      p: dense ? 2 : 3,
      borderRadius: 2.5,
    }}
  >
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      {right}
    </Stack>
    <Box sx={{ mt: dense ? 1 : 1.5 }}>{children}</Box>
  </Paper>
);
