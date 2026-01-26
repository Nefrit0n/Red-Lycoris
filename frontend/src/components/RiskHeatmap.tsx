import { Box, Paper, Tooltip, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ProductWithStats } from "../types/products";
import { semantic } from "../design-system/tokens/colors";

interface RiskHeatmapProps {
  products: ProductWithStats[];
  maxItems?: number;
}

const calculateRiskScore = (product: ProductWithStats): number => {
  if (!product.severityBreakdown) {
    // If no breakdown, use findingsOpenCount as a rough estimate
    if (product.findingsOpenCount === 0) return 0;
    if (product.findingsOpenCount <= 5) return 25;
    if (product.findingsOpenCount <= 15) return 50;
    if (product.findingsOpenCount <= 30) return 75;
    return 100;
  }

  const { critical, high, medium, low, info } = product.severityBreakdown;
  const total = critical + high + medium + low + info;

  if (total === 0) return 0;

  // Weighted risk score: Critical has most impact
  const weightedScore =
    critical * 100 + high * 40 + medium * 15 + low * 5 + info * 1;

  // Normalize based on max expected weighted score
  const maxScore = total * 100;
  return Math.min(100, Math.round((weightedScore / maxScore) * 100));
};

const getRiskColor = (score: number): string => {
  if (score === 0) return semantic.severity.low.base;     // Green - no risk
  if (score <= 20) return semantic.severity.low.light;    // Light green
  if (score <= 40) return "#cddc39";                       // Lime (transitional)
  if (score <= 60) return semantic.severity.medium.light; // Yellow
  if (score <= 80) return semantic.severity.medium.base;  // Orange
  return semantic.severity.high.base;                      // Red - high risk
};

const getRiskLabel = (score: number): string => {
  if (score === 0) return "Безопасно";
  if (score <= 20) return "Низкий риск";
  if (score <= 40) return "Умеренный";
  if (score <= 60) return "Средний";
  if (score <= 80) return "Высокий";
  return "Критический";
};

interface HeatmapCellProps {
  product: ProductWithStats;
  riskScore: number;
  onClick: () => void;
}

const HeatmapCell = ({ product, riskScore, onClick }: HeatmapCellProps) => {
  const theme = useTheme();
  const riskColor = getRiskColor(riskScore);
  const riskLabel = getRiskLabel(riskScore);

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2" fontWeight={600}>
        {product.name}
      </Typography>
      {product.identifier && (
        <Typography variant="caption" color="text.secondary">
          {product.identifier}
        </Typography>
      )}
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption">
          Риск: <strong>{riskLabel}</strong> ({riskScore}%)
        </Typography>
      </Box>
      {product.severityBreakdown && (
        <Box sx={{ mt: 0.5, display: "flex", gap: 1 }}>
          <Typography variant="caption" sx={{ color: semantic.severity.critical.base }}>
            C:{product.severityBreakdown.critical}
          </Typography>
          <Typography variant="caption" sx={{ color: semantic.severity.high.base }}>
            H:{product.severityBreakdown.high}
          </Typography>
          <Typography variant="caption" sx={{ color: semantic.severity.medium.light }}>
            M:{product.severityBreakdown.medium}
          </Typography>
          <Typography variant="caption" sx={{ color: semantic.severity.low.base }}>
            L:{product.severityBreakdown.low}
          </Typography>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
        Всего открытых: {product.findingsOpenCount}
      </Typography>
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <Box
        onClick={onClick}
        sx={{
          width: "100%",
          aspectRatio: "1",
          bgcolor: riskColor,
          borderRadius: 1,
          cursor: "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          "&:hover": {
            transform: "scale(1.05)",
            boxShadow: 3,
            zIndex: 1,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)",
            pointerEvents: "none",
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: riskScore > 40 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)",
            fontWeight: 600,
            fontSize: "0.65rem",
            textAlign: "center",
            px: 0.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "90%",
          }}
        >
          {product.name.length > 12 ? `${product.name.slice(0, 10)}…` : product.name}
        </Typography>
      </Box>
    </Tooltip>
  );
};

const RiskHeatmap = ({ products, maxItems = 20 }: RiskHeatmapProps) => {
  const navigate = useNavigate();

  // Calculate risk scores and sort by risk (highest first)
  const productsWithRisk = products
    .map((product) => ({
      product,
      riskScore: calculateRiskScore(product),
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, maxItems);

  if (productsWithRisk.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          textAlign: "center",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography color="text.secondary">
          Нет данных для отображения heatmap
        </Typography>
      </Paper>
    );
  }

  // Determine grid size based on number of products
  const gridCols = Math.min(5, Math.ceil(Math.sqrt(productsWithRisk.length)));

  return (
    <Box>
      {/* Legend */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        {[
          { score: 0, label: "Безопасно" },
          { score: 30, label: "Низкий" },
          { score: 50, label: "Средний" },
          { score: 70, label: "Высокий" },
          { score: 100, label: "Критический" },
        ].map(({ score, label }) => (
          <Box key={score} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 0.5,
                bgcolor: getRiskColor(score),
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Heatmap Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: 1,
          maxWidth: gridCols * 80,
          mx: "auto",
        }}
      >
        {productsWithRisk.map(({ product, riskScore }) => (
          <HeatmapCell
            key={product.id}
            product={product}
            riskScore={riskScore}
            onClick={() => navigate(`/products/${product.id}`)}
          />
        ))}
      </Box>
    </Box>
  );
};

export default RiskHeatmap;
