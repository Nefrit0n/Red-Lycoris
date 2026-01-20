import { Box, Paper, Typography, Skeleton, LinearProgress, Stack } from "@mui/material";

export type ProductRiskData = {
  id: string;
  name: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
};

type TopProductsChartProps = {
  data: ProductRiskData[];
  title?: string;
  loading?: boolean;
  maxItems?: number;
};

const TopProductsChart = ({
  data,
  title = "Top Products by Risk",
  loading = false,
  maxItems = 5,
}: TopProductsChartProps) => {
  const sortedData = [...data]
    .sort((a, b) => {
      const aScore = a.criticalCount * 10 + a.highCount * 5 + a.findingsCount;
      const bScore = b.criticalCount * 10 + b.highCount * 5 + b.findingsCount;
      return bScore - aScore;
    })
    .slice(0, maxItems);

  const maxCount = Math.max(...sortedData.map((d) => d.findingsCount), 1);
  const hasData = sortedData.length > 0;

  if (loading) {
    return (
      <Paper sx={{ p: 3, height: "100%" }}>
        <Skeleton variant="text" width="50%" height={28} />
        <Stack spacing={2} sx={{ mt: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Box key={i}>
              <Skeleton variant="text" width="40%" height={20} />
              <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 1 }} />
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: "100%" }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        {title}
      </Typography>

      {!hasData ? (
        <Box
          sx={{
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">No products with findings</Typography>
        </Box>
      ) : (
        <Stack spacing={2.5} sx={{ mt: 2 }}>
          {sortedData.map((product) => {
            const progress = (product.findingsCount / maxCount) * 100;
            const hasCritical = product.criticalCount > 0;
            const hasHigh = product.highCount > 0;

            let barColor = "#7aa2f7";
            if (hasCritical) {
              barColor = "#7b1fa2";
            } else if (hasHigh) {
              barColor = "#d32f2f";
            }

            return (
              <Box key={product.id}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: "60%" }}>
                    {product.name}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    {hasCritical && (
                      <Typography variant="caption" sx={{ color: "#7b1fa2", fontWeight: 600 }}>
                        {product.criticalCount}C
                      </Typography>
                    )}
                    {hasHigh && (
                      <Typography variant="caption" sx={{ color: "#d32f2f", fontWeight: 600 }}>
                        {product.highCount}H
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {product.findingsCount}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: "rgba(255,255,255,0.08)",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: barColor,
                      borderRadius: 1,
                    },
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
};

export default TopProductsChart;
