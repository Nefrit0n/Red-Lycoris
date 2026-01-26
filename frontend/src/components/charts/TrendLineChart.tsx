/**
 * TrendLineChart - Displays findings trend over time
 *
 * Uses design system tokens for consistent styling.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ChartContainer, ChartTooltip } from '../../design-system/components';
import { chartColors, chartAxis, chartLegend, lineChartConfig } from '../../design-system/tokens';

// ============================================================
// TYPES
// ============================================================

export type TrendDataPoint = {
  date: string;
  total: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
};

type TrendLineChartProps = {
  data: TrendDataPoint[];
  title?: string;
  loading?: boolean;
  showBreakdown?: boolean;
};

// ============================================================
// SEVERITY LINE CONFIG
// ============================================================

const SEVERITY_LINES = [
  { key: 'critical', name: 'Critical', color: chartColors.severity.critical },
  { key: 'high', name: 'High', color: chartColors.severity.high },
  { key: 'medium', name: 'Medium', color: chartColors.severity.medium },
  { key: 'low', name: 'Low', color: chartColors.severity.low },
] as const;

// ============================================================
// COMPONENT
// ============================================================

const TrendLineChart = ({
  data,
  title = 'Findings Trend (Last 30 Days)',
  loading = false,
  showBreakdown = false,
}: TrendLineChartProps) => {
  const hasData = data.length > 0;

  return (
    <ChartContainer
      title={title}
      loading={loading}
      hasData={hasData}
      loadingVariant="line"
      emptyMessage="No trend data available"
      height={300}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            axisLine={chartAxis.axisLine}
            tickLine={chartAxis.tickLine}
            tick={chartAxis.tick}
            dx={-10}
          />
          <Tooltip content={<ChartTooltip />} />
          {showBreakdown ? (
            <>
              {SEVERITY_LINES.map((line) => (
                <Line
                  key={line.key}
                  type={lineChartConfig.type}
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={lineChartConfig.strokeWidth}
                  dot={lineChartConfig.dot}
                  activeDot={{ r: 4 }}
                />
              ))}
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span style={{ color: chartLegend.textColor, fontSize: chartLegend.fontSize }}>
                    {value}
                  </span>
                )}
              />
            </>
          ) : (
            <Line
              type={lineChartConfig.type}
              dataKey="total"
              name="Total Findings"
              stroke={chartColors.primary}
              strokeWidth={lineChartConfig.strokeWidth}
              dot={lineChartConfig.dot}
              activeDot={lineChartConfig.activeDot}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default TrendLineChart;
