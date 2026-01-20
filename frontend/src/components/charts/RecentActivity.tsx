import { Box, Paper, Typography, Skeleton, Stack, Chip } from "@mui/material";
import {
  BugReport as BugReportIcon,
  CheckCircle as CheckCircleIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

export type ActivityItem = {
  id: string;
  type: "new_finding" | "status_change" | "scan_upload";
  title: string;
  description?: string;
  severity?: string;
  timestamp: string;
};

type RecentActivityProps = {
  data: ActivityItem[];
  title?: string;
  loading?: boolean;
  maxItems?: number;
};

const ACTIVITY_ICONS = {
  new_finding: <BugReportIcon fontSize="small" />,
  status_change: <CheckCircleIcon fontSize="small" />,
  scan_upload: <UploadIcon fontSize="small" />,
};

const ACTIVITY_COLORS = {
  new_finding: "#d32f2f",
  status_change: "#2e7d32",
  scan_upload: "#7aa2f7",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#7b1fa2",
  high: "#d32f2f",
  medium: "#ed6c02",
  low: "#2e7d32",
};

const RecentActivity = ({
  data,
  title = "Recent Activity",
  loading = false,
  maxItems = 8,
}: RecentActivityProps) => {
  const items = data.slice(0, maxItems);
  const hasData = items.length > 0;

  if (loading) {
    return (
      <Paper sx={{ p: 3, height: "100%" }}>
        <Skeleton variant="text" width="40%" height={28} />
        <Stack spacing={2} sx={{ mt: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Box key={i} sx={{ display: "flex", gap: 2 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="text" width="40%" height={16} />
              </Box>
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        {title}
      </Typography>

      {!hasData ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">No recent activity</Typography>
        </Box>
      ) : (
        <Stack spacing={0} sx={{ flex: 1, overflowY: "auto" }}>
          {items.map((item, index) => (
            <Box
              key={item.id}
              sx={{
                display: "flex",
                gap: 2,
                py: 1.5,
                borderBottom: index < items.length - 1 ? "1px solid" : "none",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  bgcolor: `${ACTIVITY_COLORS[item.type]}20`,
                  color: ACTIVITY_COLORS[item.type],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {ACTIVITY_ICONS[item.type]}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: "70%" }}>
                    {item.title}
                  </Typography>
                  {item.severity && (
                    <Chip
                      label={item.severity}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        fontWeight: 600,
                        bgcolor: `${SEVERITY_COLORS[item.severity] || "#666"}20`,
                        color: SEVERITY_COLORS[item.severity] || "#666",
                      }}
                    />
                  )}
                </Box>
                {item.description && (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {item.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ru })}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
};

export default RecentActivity;
