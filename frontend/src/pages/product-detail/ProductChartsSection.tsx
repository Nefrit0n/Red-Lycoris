import { Grid } from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";
import { ChartContainer, ChartTooltip } from "../../design-system/components";
import { semantic } from "../../design-system/tokens";
import type { ProductDetail } from "../../types/products";

interface ProductChartsSectionProps {
  severityBreakdown?: ProductDetail["severityBreakdown"];
  openCount: number;
  fixedCount: number;
  falsePositiveCount: number;
}

const SEVERITY_COLORS = {
  critical: semantic.severity.critical.base,
  high: semantic.severity.high.base,
  medium: semantic.severity.medium.base,
  low: semantic.severity.low.base,
  info: semantic.severity.info.base,
};

const buildSeverityData = (breakdown?: ProductDetail["severityBreakdown"]) => {
  if (!breakdown) return [];
  return [
    { name: "Critical", value: breakdown.critical, color: SEVERITY_COLORS.critical },
    { name: "High", value: breakdown.high, color: SEVERITY_COLORS.high },
    { name: "Medium", value: breakdown.medium, color: SEVERITY_COLORS.medium },
    { name: "Low", value: breakdown.low, color: SEVERITY_COLORS.low },
    { name: "Info", value: breakdown.info, color: SEVERITY_COLORS.info },
  ];
};

const STATUS_BAR_COLORS = {
  open: semantic.status.new.base,
  fixed: semantic.status.resolved.base,
  falsePositive: semantic.status.dismissed.base,
};

export const ProductChartsSection = ({
  severityBreakdown,
  openCount,
  fixedCount,
  falsePositiveCount,
}: ProductChartsSectionProps) => {
  const severityData = buildSeverityData(severityBreakdown);
  const pieData = severityData.filter((item) => item.value > 0);
  const hasSeverityData = severityData.some((item) => item.value > 0);

  const statusData = [
    { name: "Open", value: openCount, color: STATUS_BAR_COLORS.open },
    { name: "Fixed", value: fixedCount, color: STATUS_BAR_COLORS.fixed },
    { name: "False Positive", value: falsePositiveCount, color: STATUS_BAR_COLORS.falsePositive },
  ];
  const hasStatusData = statusData.some((item) => item.value > 0);

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <ChartContainer
          title="Severity distribution"
          subtitle="Open findings breakdown"
          height={240}
          loadingVariant="pie"
          hasData={hasSeverityData}
          emptyMessage="No open findings"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={0}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`pie-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <ChartContainer
          title="Findings by status"
          subtitle="Open vs Fixed vs False Positive"
          height={240}
          loadingVariant="bar"
          hasData={hasStatusData}
          emptyMessage="No findings data"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={statusData}
              layout="vertical"
              margin={{ left: 80, right: 24 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                {statusData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Grid>
    </Grid>
  );
};
