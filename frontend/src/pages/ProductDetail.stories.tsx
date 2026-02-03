import type { Meta, StoryObj } from "@storybook/react";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SecurityIcon from "@mui/icons-material/Security";
import WarningIcon from "@mui/icons-material/Warning";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, GlassCard, MetricDisplay } from "../design-system/components";
import { semantic } from "../design-system/tokens";

const severityColors = {
  critical: semantic.severity.critical.base,
  high: semantic.severity.high.base,
  medium: semantic.severity.medium.base,
  low: semantic.severity.low.base,
  info: semantic.severity.info.base,
};

const severityData = [
  { name: "Critical", value: 2, color: severityColors.critical },
  { name: "High", value: 5, color: severityColors.high },
  { name: "Medium", value: 8, color: severityColors.medium },
  { name: "Low", value: 6, color: severityColors.low },
  { name: "Info", value: 1, color: severityColors.info },
];

const ProductDetailStory = ({ state = "loaded" }: { state: "loaded" | "loading" | "empty" }) => {
  const theme = useTheme();
  const hasData = state === "loaded";
  const isLoading = state === "loading";

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Button startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
            Back to products
          </Button>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h4" component="h1" fontWeight={700}>
                Gateway API
              </Typography>
              <Typography variant="body1" color="text.secondary">
                github.com/red-lycoris/gateway • v2.4.1
              </Typography>
            </Box>
            <Chip
              label="Health: 82%"
              sx={{
                bgcolor: alpha(theme.palette.success.main, 0.2),
                color: theme.palette.success.main,
                border: `1px solid ${alpha(theme.palette.success.main, 0.4)}`,
                fontWeight: 700,
              }}
            />
          </Stack>
        </Stack>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Overview
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <MetricDisplay
              title="Open findings"
              value={hasData ? 24 : "—"}
              size="small"
              variant="subtle"
              color="warning"
              icon={<BugReportIcon />}
              loading={isLoading}
            />
            <MetricDisplay
              title="Critical / High"
              value={hasData ? 7 : "—"}
              size="small"
              variant="subtle"
              color="error"
              icon={<WarningIcon />}
              loading={isLoading}
            />
            <MetricDisplay
              title="Fixed"
              value={hasData ? 14 : "—"}
              size="small"
              variant="subtle"
              color="success"
              icon={<CheckCircleIcon />}
              loading={isLoading}
            />
            <MetricDisplay
              title="False positives"
              value={hasData ? 2 : "—"}
              size="small"
              variant="subtle"
              color="default"
              icon={<SecurityIcon />}
              loading={isLoading}
            />
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartContainer
              title="Severity distribution"
              subtitle="Open findings breakdown"
              height={240}
              loading={isLoading}
              loadingVariant="pie"
              hasData={hasData}
              emptyMessage="No open findings"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90}>
                    {severityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartContainer
              title="Severity breakdown"
              subtitle="Distribution by severity tier"
              height={240}
              loading={isLoading}
              loadingVariant="bar"
              hasData={hasData}
              emptyMessage="No open findings"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} layout="vertical" margin={{ left: 40, right: 24 }}>
                  <XAxis type="number" tick={{ fill: theme.palette.text.secondary }} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fill: theme.palette.text.secondary }} axisLine={false} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {severityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassCard variant="subtle" padding="comfortable">
              <Stack spacing={2}>
                <Typography variant="h6">Recent scans</Typography>
                {hasData ? (
                  <Stack spacing={1.5}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography variant="body2">Snyk • 2 hours ago</Typography>
                      <Chip label="5 new" size="small" color="info" variant="outlined" />
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography variant="body2">Trivy • yesterday</Typography>
                      <Chip label="No new findings" size="small" variant="outlined" />
                    </Box>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No scans available.
                  </Typography>
                )}
              </Stack>
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassCard variant="subtle" padding="comfortable">
              <Stack spacing={2}>
                <Typography variant="h6">Actions</Typography>
                <Button variant="contained" fullWidth>
                  View all findings (24)
                </Button>
                <Button variant="outlined" fullWidth>
                  Only Critical / High
                </Button>
                <Button variant="outlined" fullWidth>
                  Upload scan
                </Button>
              </Stack>
            </GlassCard>
          </Grid>
        </Grid>

        <GlassCard variant="subtle" padding="comfortable">
          <Stack spacing={2}>
            <Typography variant="h6">SBOM & Components</Typography>
            <Tabs value={0} onChange={() => undefined}>
              <Tab label="SBOM" />
              <Tab label="Components" />
            </Tabs>
            <Typography variant="body2" color="text.secondary">
              SBOM management preview in Storybook.
            </Typography>
          </Stack>
        </GlassCard>
      </Stack>
    </Container>
  );
};

const meta: Meta<typeof ProductDetailStory> = {
  title: "Pages/ProductDetail",
  component: ProductDetailStory,
  parameters: { layout: "fullscreen" },
  args: {
    state: "loaded",
  },
  argTypes: {
    state: { control: { type: "radio" }, options: ["loaded", "loading", "empty"] },
  },
};

export default meta;

type Story = StoryObj<typeof ProductDetailStory>;

export const Default: Story = {};

export const Loading: Story = {
  args: { state: "loading" },
};

export const Empty: Story = {
  args: { state: "empty" },
};
