import React, { memo, useMemo } from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { Pie, PieChart, Cell } from "recharts";
import { semantic } from "../design-system/tokens";
import { ProductWithStats } from "../types/products";

export interface ProductPostureDonutProps {
  breakdown?: ProductWithStats["severityBreakdown"];
  size?: number;
  thickness?: number;
  showCenterLabel?: boolean;
}

const severityColors = {
  critical: semantic.severity.critical.base,
  high: semantic.severity.high.base,
  medium: semantic.severity.medium.base,
  low: semantic.severity.low.base,
  info: semantic.severity.info.base,
};

const ProductPostureDonut = memo(
  ({ breakdown, size = 72, thickness = 10, showCenterLabel = true }: ProductPostureDonutProps) => {
    const theme = useTheme();
    const data = useMemo(() => {
      if (!breakdown) return [];
      return [
        { key: "critical", label: "Critical", value: breakdown.critical },
        { key: "high", label: "High", value: breakdown.high },
        { key: "medium", label: "Medium", value: breakdown.medium },
        { key: "low", label: "Low", value: breakdown.low },
        { key: "info", label: "Info", value: breakdown.info },
      ].filter((item) => item.value > 0);
    }, [breakdown]);

    const total = useMemo(() => {
      if (!breakdown) return 0;
      return (
        breakdown.critical +
        breakdown.high +
        breakdown.medium +
        breakdown.low +
        breakdown.info
      );
    }, [breakdown]);

    if (total === 0) {
      return (
        <Box
          sx={{
            width: size,
            height: size,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            bgcolor: alpha(theme.palette.success.main, 0.15),
            color: theme.palette.success.light,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
          }}
        >
          <ShieldOutlinedIcon sx={{ fontSize: size * 0.35 }} />
          {showCenterLabel && (
            <Typography variant="caption" sx={{ mt: 0.25, fontWeight: 600 }}>
              Clear
            </Typography>
          )}
        </Box>
      );
    }

    return (
      <Box sx={{ width: size, height: size, position: "relative" }}>
        <PieChart width={size} height={size}>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={size / 2 - thickness}
            outerRadius={size / 2}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={severityColors[entry.key as keyof typeof severityColors]} />
            ))}
          </Pie>
        </PieChart>
        {showCenterLabel && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1 }}
            >
              {total}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              open
            </Typography>
          </Box>
        )}
      </Box>
    );
  }
);

ProductPostureDonut.displayName = "ProductPostureDonut";

export default ProductPostureDonut;
