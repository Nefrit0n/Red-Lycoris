/**
 * StatusBarChart - Displays findings distribution by status
 *
 * Uses design system tokens for consistent styling.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, SimpleTooltip } from '../../design-system/components';
import { chartAxis, chartCursor, barChartConfig } from '../../design-system/tokens';

// ============================================================
// TYPES
// ============================================================

export type StatusData = {
  name: string;
  value: number;
  color: string;
};

type StatusBarChartProps = {
  data: StatusData[];
  title?: string;
  loading?: boolean;
};

// ============================================================
// COMPONENT
// ============================================================

const StatusBarChart = ({
  data,
  title = 'Findings by Status',
  loading = false,
}: StatusBarChartProps) => {
  const hasData = data.some((item) => item.value > 0);

  return (
    <ChartContainer
      title={title}
      loading={loading}
      hasData={hasData}
      loadingVariant="bar"
      emptyMessage="No data available"
      height={250}
    >
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={chartAxis.axisLine}
            tickLine={chartAxis.tickLine}
            tick={chartAxis.tick}
            width={100}
          />
          <Tooltip content={<SimpleTooltip suffix="findings" />} cursor={chartCursor} />
          <Bar
            dataKey="value"
            radius={barChartConfig.radius}
            barSize={barChartConfig.barSize}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default StatusBarChart;
