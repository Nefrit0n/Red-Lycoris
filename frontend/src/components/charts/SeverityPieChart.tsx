import { Box, Paper, Typography, Skeleton } from "@mui/material";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

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

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) => {
  if (percent < 0.05) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#f5f7ff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <Paper sx={{ p: 1.5, bgcolor: "background.paper" }}>
        <Typography variant="body2" fontWeight={600} sx={{ color: data.color }}>
          {data.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.value} findings
        </Typography>
      </Paper>
    );
  }
  return null;
};

const SeverityPieChart = ({ data, title = "Findings by Severity", loading = false }: SeverityPieChartProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;

  if (loading) {
    return (
      <Paper sx={{ p: 3, height: "100%" }}>
        <Skeleton variant="text" width="50%" height={28} />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Skeleton variant="circular" width={200} height={200} />
        </Box>
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
            height: 250,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">No data available</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={100}
              innerRadius={50}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span style={{ color: "#a5adba", fontSize: 12 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};

export default SeverityPieChart;
