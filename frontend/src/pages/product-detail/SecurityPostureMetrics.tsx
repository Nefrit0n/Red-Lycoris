import { Box, Typography } from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SecurityIcon from "@mui/icons-material/Security";
import WarningIcon from "@mui/icons-material/Warning";
import { MetricDisplay } from "../../design-system/components";
import type { TrendInfo } from "../../design-system/components";

interface SecurityPostureMetricsProps {
  openFindings: number;
  criticalHighCount: number;
  fixedCount: number;
  falsePositiveCount: number;
  trend?: { direction: "up" | "down" | "flat"; value: number };
}

export const SecurityPostureMetrics = ({
  openFindings,
  criticalHighCount,
  fixedCount,
  falsePositiveCount,
  trend,
}: SecurityPostureMetricsProps) => {
  const openTrend: TrendInfo | undefined = trend
    ? { value: trend.value, direction: trend.direction, isPositive: trend.direction === "down", label: "vs last period" }
    : undefined;

  const fixedTrend: TrendInfo | undefined = trend
    ? { value: trend.value, direction: trend.direction, isPositive: trend.direction === "up", label: "vs last period" }
    : undefined;

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Security Posture
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <MetricDisplay
          title="Open findings"
          value={openFindings}
          size="small"
          variant="subtle"
          color="warning"
          icon={<BugReportIcon />}
          trend={openTrend}
        />
        <MetricDisplay
          title="Critical / High"
          value={criticalHighCount}
          size="small"
          variant="subtle"
          color="error"
          icon={<WarningIcon />}
        />
        <MetricDisplay
          title="Fixed"
          value={fixedCount}
          size="small"
          variant="subtle"
          color="success"
          icon={<CheckCircleIcon />}
          trend={fixedTrend}
        />
        <MetricDisplay
          title="False positives"
          value={falsePositiveCount}
          size="small"
          variant="subtle"
          color="default"
          icon={<SecurityIcon />}
        />
      </Box>
    </Box>
  );
};
