/**
 * SeverityPieChart - Displays findings distribution by severity
 *
 * Uses design system tokens for consistent styling.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer, SimpleTooltip } from '../../design-system/components';
import { chartColors, chartLegend, pieChartConfig } from '../../design-system/tokens';
import { primitives } from '../../design-system/tokens/colors';

// ============================================================
// TYPES
// ============================================================

export type SeverityData = {
  name: string;
  value: number;
  color: string;
};

type SeverityPieChartProps = {
  data: SeverityData[];
  title?: string;
  loading?: boolean;
};

// ============================================================
// HELPERS
// ============================================================

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;

  if (!percent || percent < 0.05) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill={pieChartConfig.labelFill}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={pieChartConfig.labelFontSize}
      fontWeight={pieChartConfig.labelFontWeight}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ============================================================
// COMPONENT
// ============================================================

const SeverityPieChart = ({
  data,
  title = 'Findings by Severity',
  loading = false,
}: SeverityPieChartProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;

  return (
    <ChartContainer
      title={title}
      loading={loading}
      hasData={hasData}
      loadingVariant="pie"
      emptyMessage="No data available"
      height={250}
    >
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={pieChartConfig.outerRadius}
            innerRadius={pieChartConfig.innerRadius}
            paddingAngle={pieChartConfig.paddingAngle}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<SimpleTooltip suffix="findings" />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span style={{ color: chartLegend.textColor, fontSize: chartLegend.fontSize }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default SeverityPieChart;
