import React, { memo, useMemo } from "react";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import { GlassCard, StatusBadge } from "../design-system/components";
import { ProductWithStats } from "../types/products";
import ProductPostureDonut from "./ProductPostureDonut";
import { semantic } from "../design-system/tokens";

export interface ProductGridCardProps {
  product: ProductWithStats;
  onOpen?: () => void;
  onViewFindings?: () => void;
  onUploadScan?: () => void;
}

const ProductGridCard = memo(({ product, onOpen, onViewFindings, onUploadScan }: ProductGridCardProps) => {
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

  const daysSinceScan = lastScanDate
    ? Math.floor((Date.now() - lastScanDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isSlaRisk = daysSinceScan !== null && daysSinceScan > 30;
  const isFreshScan = daysSinceScan !== null && daysSinceScan <= 1;

  const criticalCount = product.severityBreakdown?.critical ?? 0;
  const highCount = product.severityBreakdown?.high ?? 0;

  const identifierText = product.identifier || product.version
    ? `${product.identifier ?? ""}${product.version ? ` • v${product.version}` : ""}`
    : "No repository linked";

  return (
    <GlassCard
      variant="light"
      glowColor="lotus"
      padding="comfortable"
      interactive
      onClick={onOpen}
      sx={{
        minHeight: 280,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        "&:hover .product-card-actions": {
          opacity: 1,
          transform: "translateY(0)",
        },
      }}
    >
      <Box
        className="product-card-actions"
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          gap: 0.5,
          opacity: 0,
          transform: "translateY(-6px)",
          transition: "all 180ms ease",
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

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
            {product.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {identifierText}
          </Typography>
        </Box>
        <Chip
          label={`${healthScore}%`}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: alpha(scoreColor, 0.2),
            color: scoreColor,
            border: `1px solid ${alpha(scoreColor, 0.4)}`,
          }}
        />
      </Box>

      <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.08) }} />

      <Stack direction="row" spacing={2} alignItems="center">
        <ProductPostureDonut breakdown={product.severityBreakdown} size={68} />
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Security posture
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" sx={{ color: semantic.severity.critical.text }}>
              ● {criticalCount} critical
            </Typography>
            <Typography variant="caption" sx={{ color: semantic.severity.high.text }}>
              ● {highCount} high
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {product.findingsOpenCount} open findings
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.08) }} />

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
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
        {isSlaRisk && <Chip label="SLA risk" size="small" color="warning" variant="outlined" />}
        {isFreshScan && (
          <Chip
            label="new scan"
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.success.main, 0.15),
              color: theme.palette.success.light,
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
            }}
          />
        )}
        {!isSlaRisk && !isFreshScan && criticalCount === 0 && highCount === 0 && (
          <Chip label="stable" size="small" variant="outlined" />
        )}
      </Stack>

      <Box sx={{ mt: "auto", display: "flex", alignItems: "center", gap: 1 }}>
        <CalendarMonthOutlinedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary">
          Last scan {lastScanLabel}
        </Typography>
      </Box>
    </GlassCard>
  );
});

ProductGridCard.displayName = "ProductGridCard";

export default ProductGridCard;
