/**
 * TopProductsChart - Displays top products by risk score
 *
 * Uses design system tokens for consistent styling.
 */

import { Box, Typography, LinearProgress, Stack } from '@mui/material';
import { ChartContainer } from '../../design-system/components';
import { chartColors, progressBarConfig } from '../../design-system/tokens';
import { primitives, alpha } from '../../design-system/tokens/colors';

// ============================================================
// TYPES
// ============================================================

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

// ============================================================
// COMPONENT
// ============================================================

const TopProductsChart = ({
  data,
  title = 'Top Products by Risk',
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

  return (
    <ChartContainer
      title={title}
      loading={loading}
      hasData={hasData}
      loadingVariant="bar"
      emptyMessage="No products with findings"
      height={200}
    >
      <Stack spacing={2.5} sx={{ mt: 1 }}>
        {sortedData.map((product) => {
          const progress = (product.findingsCount / maxCount) * 100;
          const barColor = progressBarConfig.getSeverityColor(
            product.criticalCount,
            product.highCount
          );

          return (
            <Box key={product.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  noWrap
                  sx={{ maxWidth: '60%', color: primitives.night[100] }}
                >
                  {product.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {product.criticalCount > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: chartColors.severity.critical, fontWeight: 600 }}
                    >
                      {product.criticalCount}C
                    </Typography>
                  )}
                  {product.highCount > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: chartColors.severity.high, fontWeight: 600 }}
                    >
                      {product.highCount}H
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ color: primitives.night[300] }}>
                    {product.findingsCount}
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: progressBarConfig.height,
                  borderRadius: progressBarConfig.borderRadius,
                  bgcolor: progressBarConfig.backgroundColor,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: barColor,
                    borderRadius: progressBarConfig.borderRadius,
                  },
                }}
              />
            </Box>
          );
        })}
      </Stack>
    </ChartContainer>
  );
};

export default TopProductsChart;
