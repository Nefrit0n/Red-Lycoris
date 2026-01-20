import { Box, Paper, Typography, Skeleton } from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 1.5, bgcolor: "background.paper" }}>
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {payload[0].value} findings
        </Typography>
      </Paper>
    );
  }
  return null;
};

const StatusBarChart = ({ data, title = "Findings by Status", loading = false }: StatusBarChartProps) => {
  const hasData = data.some((item) => item.value > 0);

  if (loading) {
    return (
      <Paper sx={{ p: 3, height: "100%" }}>
        <Skeleton variant="text" width="50%" height={28} />
        <Box sx={{ mt: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={24} sx={{ mb: 1, borderRadius: 1 }} />
          ))}
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
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a5adba", fontSize: 12 }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};

export default StatusBarChart;
