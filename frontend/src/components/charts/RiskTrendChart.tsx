/**
 * RiskTrendChart - Displays risk score trend with critical count
 *
 * Uses design system tokens for consistent styling.
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip } from '../../design-system/components';
import { chartColors, chartAxis, chartLegend, lineChartConfig } from '../../design-system/tokens';

// ============================================================
// TYPES
// ============================================================

export type RiskTrendDataPoint = {
  date: string;
  avgRisk: number;
  criticalCount: number;
};

type RiskTrendChartProps = {
  data: RiskTrendDataPoint[];
  title?: string;
  loading?: boolean;
};

// ============================================================
// COMPONENT
// ============================================================

const RiskTrendChart = ({
  data,
  title = 'Risk trend',
  loading = false,
}: RiskTrendChartProps) => {
  const hasData = data.length > 0;

  return (
    <ChartContainer
      title={title}
      loading={loading}
      hasData={hasData}
      loadingVariant="line"
      emptyMessage="No risk trend data"
      height={240}
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray={chartAxis.grid.strokeDasharray}
            stroke={chartAxis.grid.stroke}
          />
          <XAxis
            dataKey="date"
            axisLine={chartAxis.axisLine}
            tickLine={chartAxis.tickLine}
            tick={chartAxis.tick}
            dy={10}
          />
          <YAxis
            yAxisId="left"
            axisLine={chartAxis.axisLine}
            tickLine={chartAxis.tickLine}
            tick={chartAxis.tick}
            domain={[0, 100]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={chartAxis.axisLine}
            tickLine={chartAxis.tickLine}
            tick={chartAxis.tick}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span style={{ color: chartLegend.textColor, fontSize: chartLegend.fontSize }}>
                {value}
              </span>
            )}
          />
          <Line
            yAxisId="left"
            type={lineChartConfig.type}
            dataKey="avgRisk"
            name="Avg risk"
            stroke={chartColors.risk.avgRisk}
            strokeWidth={lineChartConfig.strokeWidth}
            dot={lineChartConfig.dot}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type={lineChartConfig.type}
            dataKey="criticalCount"
            name="Critical count"
            stroke={chartColors.risk.critical}
            strokeWidth={lineChartConfig.strokeWidth}
            dot={lineChartConfig.dot}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default RiskTrendChart;
