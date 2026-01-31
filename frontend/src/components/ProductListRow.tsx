import React, { memo, useMemo } from "react";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import { GlassCard, StatusBadge } from "../design-system/components";
import { ProductWithStats } from "../types/products";
import ProductPostureDonut from "./ProductPostureDonut";

export interface ProductListRowProps {
  product: ProductWithStats;
  onOpen?: () => void;
  onViewFindings?: () => void;
  onUploadScan?: () => void;
}

const ProductListRow = memo(({ product, onOpen, onViewFindings, onUploadScan }: ProductListRowProps) => {
  const theme = useTheme();

  const healthScore = useMemo(() => {
    const breakdown = product.severityBreakdown;
    if (!breakdown) return 100;
    const total =
      breakdown.critical + breakdown.high + breakdown.medium + breakdown.low + breakdown.info;
    if (total === 0) return 100;
    const weighted =
      breakdown.critical * 10 +
      breakdown.high * 5 +
      breakdown.medium * 2 +
      breakdown.low * 1 +
      breakdown.info * 0.5;
    const score = Math.max(0, Math.round(100 - (weighted / (total * 10)) * 100));
    return score;
  }, [product.severityBreakdown]);

  const scoreColor = useMemo(() => {
    if (healthScore >= 80) return theme.palette.success.main;
    if (healthScore >= 60) return theme.palette.info.main;
    if (healthScore >= 40) return theme.palette.warning.main;
    return theme.palette.error.main;
  }, [healthScore, theme.palette]);

  const lastScanDate = product.lastScanAt ? new Date(product.lastScanAt) : null;
  const lastScanLabel = lastScanDate
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(lastScanDate)
    : "No scans";

  const criticalCount = product.severityBreakdown?.critical ?? 0;
  const highCount = product.severityBreakdown?.high ?? 0;

  const identifierText = product.identifier || product.version
    ? `${product.identifier ?? ""}${product.version ? ` • v${product.version}` : ""}`
    : "No repository linked";

  return (
    <GlassCard
      variant="subtle"
      padding="normal"
      interactive
      onClick={onOpen}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "2fr 1.2fr 1.1fr 1.2fr auto" },
        gap: { xs: 2, md: 3 },
        alignItems: "center",
        position: "relative",
        "&:hover .product-row-actions": {
          opacity: 1,
        },
      }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
          {product.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {identifierText}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <ProductPostureDonut breakdown={product.severityBreakdown} size={56} thickness={8} />
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Security posture
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {criticalCount > 0 && (
              <StatusBadge
                type="severity"
                value="critical"
                label={`${criticalCount} critical`}
                compact
              />
            )}
            {highCount > 0 && (
              <StatusBadge type="severity" value="high" label={`${highCount} high`} compact />
            )}
            {criticalCount === 0 && highCount === 0 && (
              <Chip label="stable" size="small" variant="outlined" />
            )}
          </Stack>
        </Stack>
      </Stack>

      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          Coverage
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: scoreColor }}>
          {healthScore}%
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <CalendarMonthOutlinedIcon fontSize="small" color="action" />
        <Typography variant="body2" color="text.secondary">
          {lastScanLabel}
        </Typography>
      </Stack>

      <Box
        className="product-row-actions"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          opacity: { xs: 1, md: 0 },
          transition: "opacity 160ms ease",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Open product">
          <IconButton size="small" onClick={onOpen}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="View findings">
          <IconButton size="small" onClick={onViewFindings}>
            <BugReportOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Upload scan">
          <IconButton size="small" onClick={onUploadScan}>
            <UploadFileOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </GlassCard>
  );
});

ProductListRow.displayName = "ProductListRow";

export default ProductListRow;
