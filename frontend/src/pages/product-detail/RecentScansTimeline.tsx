import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ScheduleIcon from "@mui/icons-material/Schedule";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../../design-system/components";
import type { ProductDetail } from "../../types/products";

interface RecentScansTimelineProps {
  scans?: ProductDetail["recentScans"];
  totalScans: number;
  productId: string;
  onUploadScan: () => void;
}

const STATUS_ICONS: Record<string, React.ReactElement> = {
  completed: <CheckCircleIcon sx={{ color: "success.main" }} />,
  failed: <ErrorIcon sx={{ color: "error.main" }} />,
  processing: <ScheduleIcon sx={{ color: "warning.main" }} />,
};

const formatScanDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

export const RecentScansTimeline = ({
  scans,
  totalScans,
  productId,
  onUploadScan,
}: RecentScansTimelineProps) => {
  const navigate = useNavigate();

  return (
    <GlassCard variant="subtle" padding="comfortable">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Recent scans</Typography>
            <Typography variant="body2" color="text.secondary">
              Latest activity from import jobs
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={onUploadScan}
          >
            Upload scan
          </Button>
        </Stack>

        {!scans || scans.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No scans available.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {scans.map((scan) => (
              <Box
                key={scan.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 1.5,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  {STATUS_ICONS[scan.status] || <ScheduleIcon sx={{ color: "text.secondary" }} />}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {scan.scanner}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatScanDate(scan.createdAt)}
                  </Typography>
                </Box>
                {scan.findingsNew > 0 ? (
                  <Chip
                    label={`${scan.findingsNew} new`}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                ) : (
                  <Chip label="No new findings" size="small" variant="outlined" />
                )}
              </Box>
            ))}
          </Stack>
        )}

        {totalScans > 5 && (
          <Button
            size="small"
            onClick={() => navigate(`/imports?productId=${productId}`)}
            sx={{ alignSelf: "flex-start" }}
          >
            View all {totalScans} scans
          </Button>
        )}
      </Stack>
    </GlassCard>
  );
};
