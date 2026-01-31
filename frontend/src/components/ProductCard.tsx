import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import SecurityIcon from "@mui/icons-material/Security";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export interface ProductCardData {
  id: string;
  name: string;
  identifier?: string | null;
  version?: string | null;
  lastScanAt?: string | null;
  findingsOpenCount: number;
  latestScanFindingsNew?: number;
  severityBreakdown?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  trend?: "up" | "down" | "flat";
  trendValue?: number;
}

interface ProductCardProps {
  product: ProductCardData;
  onClick?: () => void;
}

const SEVERITY_COLORS = {
  critical: "#f44336",
  high: "#ff9800",
  medium: "#ffeb3b",
  low: "#4caf50",
  info: "#2196f3",
};

const calculateHealthScore = (breakdown?: ProductCardData["severityBreakdown"]): number => {
  if (!breakdown) return 100;
  const total = breakdown.critical + breakdown.high + breakdown.medium + breakdown.low + breakdown.info;
  if (total === 0) return 100;

  // Weighted score: critical = 10pts, high = 5pts, medium = 2pts, low = 1pt, info = 0.5pts
  const weightedSum =
    breakdown.critical * 10 +
    breakdown.high * 5 +
    breakdown.medium * 2 +
    breakdown.low * 1 +
    breakdown.info * 0.5;

  // Max possible penalty for each finding
  const maxPenalty = total * 10;
  const score = Math.max(0, Math.round(100 - (weightedSum / maxPenalty) * 100));
  return score;
};

const getHealthColor = (score: number): string => {
  if (score >= 80) return "#4caf50";
  if (score >= 60) return "#8bc34a";
  if (score >= 40) return "#ffeb3b";
  if (score >= 20) return "#ff9800";
  return "#f44336";
};

const TrendIndicator = ({ trend, value }: { trend?: "up" | "down" | "flat"; value?: number }) => {
  if (!trend || trend === "flat") {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <TrendingFlatIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" color="text.secondary">
          без изменений
        </Typography>
      </Stack>
    );
  }

  const isUp = trend === "up";
  const Icon = isUp ? TrendingUpIcon : TrendingDownIcon;
  const color = isUp ? "error.main" : "success.main";

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Icon sx={{ fontSize: 16, color }} />
      <Typography variant="caption" sx={{ color }}>
        {isUp ? "+" : "-"}{value ?? 0} за неделю
      </Typography>
    </Stack>
  );
};

const MiniSeverityChart = ({ breakdown }: { breakdown?: ProductCardData["severityBreakdown"] }) => {
  if (!breakdown) return null;

  const data = [
    { name: "Critical", value: breakdown.critical, color: SEVERITY_COLORS.critical },
    { name: "High", value: breakdown.high, color: SEVERITY_COLORS.high },
    { name: "Medium", value: breakdown.medium, color: SEVERITY_COLORS.medium },
    { name: "Low", value: breakdown.low, color: SEVERITY_COLORS.low },
    { name: "Info", value: breakdown.info, color: SEVERITY_COLORS.info },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Box
        sx={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          bgcolor: "success.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SecurityIcon sx={{ color: "white", fontSize: 24 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: 60, height: 60 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={15}
            outerRadius={28}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

const SeverityBadges = ({ breakdown }: { breakdown?: ProductCardData["severityBreakdown"] }) => {
  if (!breakdown) return null;

  const badges = [
    { label: "C", value: breakdown.critical, color: SEVERITY_COLORS.critical },
    { label: "H", value: breakdown.high, color: SEVERITY_COLORS.high },
    { label: "M", value: breakdown.medium, color: SEVERITY_COLORS.medium },
    { label: "L", value: breakdown.low, color: SEVERITY_COLORS.low },
  ].filter((b) => b.value > 0);

  if (badges.length === 0) {
    return (
      <Chip
        label="Нет находок"
        size="small"
        color="success"
        variant="outlined"
        sx={{ fontSize: "0.7rem" }}
      />
    );
  }

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {badges.map((badge) => (
        <Chip
          key={badge.label}
          label={`${badge.label}: ${badge.value}`}
          size="small"
          sx={{
            fontSize: "0.65rem",
            height: 20,
            bgcolor: badge.color,
            color: badge.label === "M" ? "rgba(0,0,0,0.87)" : "white",
            fontWeight: 600,
          }}
        />
      ))}
    </Stack>
  );
};

const ProductCard = ({ product, onClick }: ProductCardProps) => {
  const healthScore = calculateHealthScore(product.severityBreakdown);
  const healthColor = getHealthColor(healthScore);
  const newFindingsCount = product.latestScanFindingsNew ?? 0;

  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: "primary.main",
          transform: "translateY(-2px)",
          boxShadow: 2,
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Mini Chart */}
          <MiniSeverityChart breakdown={product.severityBreakdown} />

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  noWrap
                  sx={{ maxWidth: "100%" }}
                >
                  {product.name}
                </Typography>
                {product.identifier && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {product.identifier}
                    {product.version && ` v${product.version}`}
                  </Typography>
                )}
              </Box>

              {/* Health Score Badge */}
              <Chip
                label={`${healthScore}%`}
                size="small"
                sx={{
                  bgcolor: healthColor,
                  color: healthScore >= 40 && healthScore < 80 ? "rgba(0,0,0,0.87)" : "white",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  ml: 1,
                }}
              />
            </Stack>

            {/* Severity Badges */}
            <Box mb={1}>
              <SeverityBadges breakdown={product.severityBreakdown} />
            </Box>

            {/* Footer */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <TrendIndicator trend={product.trend} value={product.trendValue} />
              <Stack direction="row" spacing={1} alignItems="center">
                {newFindingsCount > 0 && (
                  <Chip
                    label={`${newFindingsCount} new`}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ fontSize: "0.65rem", height: 20 }}
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  {product.lastScanAt
                    ? new Date(product.lastScanAt).toLocaleDateString("ru-RU")
                    : "Нет сканов"}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default ProductCard;
