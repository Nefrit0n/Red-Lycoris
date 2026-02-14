import { Box, Stack, Typography } from "@mui/material";
import { Button } from "../../design-system/components/Button";
import { GlassCard } from "../../design-system/components/GlassCard";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ title, description, actionLabel, onAction }: EmptyStateProps) => (
  <GlassCard variant="subtle" sx={{ padding: 4 }}>
    <Stack spacing={1.5} alignItems="flex-start">
      <Typography variant="h6" fontWeight={600}>
        {title}
      </Typography>
      {description && <Typography color="text.secondary">{description}</Typography>}
      {actionLabel && (
        <Box>
          <Button variant="contained" onClick={onAction}>
            {actionLabel}
          </Button>
        </Box>
      )}
    </Stack>
  </GlassCard>
);

export default EmptyState;
