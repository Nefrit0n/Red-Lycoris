import { Alert, Box, Skeleton, Stack, Typography } from "@mui/material";
import { DragIndicator } from "@mui/icons-material";
import type { ReactNode } from "react";
import { GlassCard } from "../../design-system";
import { bordersDark, focusRing, radius } from "../../design-system/tokens";

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  isEditing?: boolean;
  children?: ReactNode;
}

const WidgetCard = ({
  title,
  subtitle,
  actions,
  loading,
  error,
  emptyMessage,
  isEditing,
  children,
}: WidgetCardProps) => {
  const showEmpty = !loading && !error && !children && emptyMessage;

  return (
    <GlassCard
      variant="subtle"
      padding="comfortable"
      sx={{
        height: "100%",
        border: isEditing ? bordersDark.dashedStrong : bordersDark.default,
        borderRadius: radius.card,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        "&:focus-within": {
          boxShadow: focusRing.default,
        },
      }}
    >
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={2}
          className="widget-drag-handle"
          sx={{ cursor: isEditing ? "grab" : "default" }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            {isEditing && (
              <DragIndicator
                fontSize="small"
                sx={{ color: "text.secondary", opacity: 0.6, mt: 0.25 }}
              />
            )}
            <Box>
              <Typography variant="subtitle1">{title}</Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
          {actions && <Box>{actions}</Box>}
        </Stack>

        {loading && (
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" height={24} />
            <Skeleton variant="rounded" height={24} width="80%" />
            <Skeleton variant="rounded" height={24} width="60%" />
          </Stack>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {showEmpty && (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {emptyMessage}
            </Typography>
          </Box>
        )}

        {!loading && !error && !showEmpty && (
          <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
        )}
      </Stack>
    </GlassCard>
  );
};

export default WidgetCard;
