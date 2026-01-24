import { Box, Paper, Skeleton, Typography } from "@mui/material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 1.5, bgcolor: "background.paper" }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {label}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

const RiskTrendChart = ({
  data,
  title = "Risk trend",
  loading = false,
}: RiskTrendChartProps) => {
  if (loading) {
    return (
      <Paper sx={{ p: 3, height: "100%" }}>
        <Skeleton variant="text" width="60%" height={28} />
        <Skeleton variant="rectangular" height={240} sx={{ mt: 2, borderRadius: 1 }} />
      </Paper>
    );
  }

  const hasData = data.length > 0;

  return (
    <Paper sx={{ p: 3, height: "100%" }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      {!hasData ? (
        <Box
          sx={{
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">No risk trend data</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#24283b" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a5adba", fontSize: 11 }}
              dy={10}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a5adba", fontSize: 11 }}
              domain={[0, 100]}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a5adba", fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span style={{ color: "#a5adba", fontSize: 12 }}>{value}</span>
              )}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avgRisk"
              name="Avg risk"
              stroke="#7aa2f7"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="criticalCount"
              name="Critical count"
              stroke="#d32f2f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};

export default RiskTrendChart;
