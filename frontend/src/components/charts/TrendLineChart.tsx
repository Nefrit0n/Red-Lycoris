import { Box, Paper, Typography, Skeleton } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 1.5, bgcolor: "background.paper" }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {label}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Typography
            key={index}
            variant="body2"
            sx={{ color: entry.color }}
          >
            {entry.name}: {entry.value}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

const SEVERITY_COLORS = {
  total: "#7aa2f7",
  critical: "#7b1fa2",
  high: "#d32f2f",
  medium: "#ed6c02",
  low: "#2e7d32",
};

const TrendLineChart = ({
  data,
  title = "Findings Trend (Last 30 Days)",
  loading = false,
  showBreakdown = false,
}: TrendLineChartProps) => {
  const hasData = data.length > 0;

  if (loading) {
    return (
      <Paper sx={{ p: 3, height: "100%" }}>
        <Skeleton variant="text" width="60%" height={28} />
        <Skeleton variant="rectangular" height={280} sx={{ mt: 2, borderRadius: 1 }} />
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
            height: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">No trend data available</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#24283b" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a5adba", fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a5adba", fontSize: 11 }}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            {showBreakdown ? (
              <>
                <Line
                  type="monotone"
                  dataKey="critical"
                  name="Critical"
                  stroke={SEVERITY_COLORS.critical}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  name="High"
                  stroke={SEVERITY_COLORS.high}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  name="Medium"
                  stroke={SEVERITY_COLORS.medium}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  name="Low"
                  stroke={SEVERITY_COLORS.low}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => (
                    <span style={{ color: "#a5adba", fontSize: 12 }}>{value}</span>
                  )}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="total"
                name="Total Findings"
                stroke={SEVERITY_COLORS.total}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};

export default TrendLineChart;
