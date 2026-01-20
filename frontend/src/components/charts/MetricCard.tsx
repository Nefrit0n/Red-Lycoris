import { Box, Paper, Typography, Skeleton } from "@mui/material";
import { ReactNode } from "react";

export type MetricCardProps = {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  loading?: boolean;
};

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "#7aa2f7",
  loading = false,
}: MetricCardProps) => {
  if (loading) {
    return (
      <Paper
        sx={{
          p: 3,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="40%" height={48} />
        <Skeleton variant="text" width="50%" height={20} />
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          bgcolor: color,
          borderRadius: "4px 0 0 4px",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {title}
        </Typography>
        {icon && (
          <Box sx={{ color, opacity: 0.8 }}>
            {icon}
          </Box>
        )}
      </Box>

      <Typography
        variant="h3"
        fontWeight={700}
        sx={{ mt: 1, color }}
      >
        {value}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: "auto" }}>
        {trend && (
          <Typography
            variant="body2"
            sx={{
              color: trend.isPositive ? "success.main" : "error.main",
              fontWeight: 600,
            }}
          >
            {trend.isPositive ? "+" : ""}{trend.value}%
          </Typography>
        )}
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default MetricCard;
