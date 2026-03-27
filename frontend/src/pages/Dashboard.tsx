import { useCallback } from "react";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ShieldIcon from "@mui/icons-material/Shield";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { useDashboard } from "../hooks/useDashboard";
import type {
  DashboardData,
  ProductRisk,
  RecentActivityItem,
  SeverityCount,
  TrendPoint,
} from "../types/dashboard";
import {
  glass,
  radius,
  semantic,
  darkTheme,
  primitives,
} from "../design-system/tokens";

// ---------------------------------------------------------------------------
// Severity color map
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: semantic.severity.critical.base,
  high: semantic.severity.high.base,
  medium: semantic.severity.medium.base,
  low: semantic.severity.low.base,
};

const SEVERITY_BG: Record<string, string> = {
  critical: semantic.severity.critical.subtle,
  high: semantic.severity.high.subtle,
  medium: semantic.severity.medium.subtle,
  low: semantic.severity.low.subtle,
};

// ---------------------------------------------------------------------------
// Glass card wrapper
// ---------------------------------------------------------------------------

const cardSx = {
  ...glass.light,
  borderRadius: radius.lg,
  p: 3,
  height: "100%",
} as const;

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function KpiCard({ label, value, icon, color }: KpiCardProps) {
  return (
    <Box sx={cardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography
            variant="h3"
            sx={{ fontWeight: 700, color, lineHeight: 1 }}
          >
            {value.toLocaleString()}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.5, color: darkTheme.text.secondary }}
          >
            {label}
          </Typography>
        </Box>
        <Box sx={{ color, opacity: 0.6 }}>{icon}</Box>
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Trend Chart
// ---------------------------------------------------------------------------

function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <Box sx={cardSx}>
      <Typography variant="subtitle2" sx={{ mb: 2, color: darkTheme.text.primary }}>
        Findings Trend (30 days)
      </Typography>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primitives.jade[500]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={primitives.jade[500]} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCritical" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={semantic.severity.critical.base} stopOpacity={0.3} />
              <stop offset="95%" stopColor={semantic.severity.critical.base} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: primitives.night[400], fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: primitives.night[400], fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <RechartsTooltip
            contentStyle={{
              ...glass.medium,
              borderRadius: radius.md,
              color: darkTheme.text.primary,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={primitives.jade[500]}
            fill="url(#gradTotal)"
            strokeWidth={2}
            name="Total"
          />
          <Area
            type="monotone"
            dataKey="critical"
            stroke={semantic.severity.critical.base}
            fill="url(#gradCritical)"
            strokeWidth={1.5}
            name="Critical"
          />
          <Area
            type="monotone"
            dataKey="high"
            stroke={semantic.severity.high.base}
            fill="transparent"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            name="High"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Severity Distribution Bar Chart
// ---------------------------------------------------------------------------

function SeverityChart({ data }: { data: SeverityCount[] }) {
  const ordered = ["critical", "high", "medium", "low"];
  const sorted = ordered
    .map((s) => data.find((d) => d.severity === s))
    .filter(Boolean) as SeverityCount[];

  return (
    <Box sx={cardSx}>
      <Typography variant="subtitle2" sx={{ mb: 2, color: darkTheme.text.primary }}>
        Severity Distribution
      </Typography>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: primitives.night[400], fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="severity"
            tick={{ fill: primitives.night[300], fontSize: 12, textTransform: "capitalize" } as object}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <RechartsTooltip
            contentStyle={{
              ...glass.medium,
              borderRadius: radius.md,
              color: darkTheme.text.primary,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24} isAnimationActive>
            {sorted.map((entry) => (
              <Cell
                key={entry.severity}
                fill={SEVERITY_COLORS[entry.severity] ?? primitives.night[500]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Top Products List
// ---------------------------------------------------------------------------

function TopProductsList({ products }: { products: ProductRisk[] }) {
  const maxFindings = Math.max(...products.map((p) => p.findingsCount), 1);

  return (
    <Box sx={cardSx}>
      <Typography variant="subtitle2" sx={{ mb: 2, color: darkTheme.text.primary }}>
        Top Products by Risk
      </Typography>
      <Stack spacing={2}>
        {products.length === 0 && (
          <Typography variant="body2" sx={{ color: darkTheme.text.muted }}>
            No products with findings
          </Typography>
        )}
        {products.map((p) => (
          <Box key={p.id}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="body2" noWrap sx={{ color: darkTheme.text.primary, maxWidth: "60%" }}>
                {p.name}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {p.criticalCount > 0 && (
                  <Chip
                    label={p.criticalCount}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 11,
                      bgcolor: SEVERITY_BG.critical,
                      color: semantic.severity.critical.text,
                    }}
                  />
                )}
                {p.highCount > 0 && (
                  <Chip
                    label={p.highCount}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 11,
                      bgcolor: SEVERITY_BG.high,
                      color: semantic.severity.high.text,
                    }}
                  />
                )}
                <Typography variant="caption" sx={{ color: darkTheme.text.muted, minWidth: 28, textAlign: "right" }}>
                  {p.findingsCount}
                </Typography>
              </Stack>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(p.findingsCount / maxFindings) * 100}
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.05)",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 2,
                  bgcolor:
                    p.criticalCount > 0
                      ? semantic.severity.critical.base
                      : p.highCount > 0
                        ? semantic.severity.high.base
                        : semantic.severity.medium.base,
                },
              }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Recent Activity List
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function RecentActivityList({ items }: { items: RecentActivityItem[] }) {
  return (
    <Box sx={cardSx}>
      <Typography variant="subtitle2" sx={{ mb: 2, color: darkTheme.text.primary }}>
        Recent Activity
      </Typography>
      <Stack spacing={1.5}>
        {items.length === 0 && (
          <Typography variant="body2" sx={{ color: darkTheme.text.muted }}>
            No recent activity
          </Typography>
        )}
        {items.map((item) => (
          <Stack key={item.id} direction="row" alignItems="flex-start" spacing={1.5}>
            {item.severity && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  mt: 0.8,
                  flexShrink: 0,
                  bgcolor: SEVERITY_COLORS[item.severity] ?? primitives.night[500],
                }}
              />
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" noWrap sx={{ color: darkTheme.text.primary }}>
                {item.title}
              </Typography>
              {item.description && (
                <Typography variant="caption" sx={{ color: darkTheme.text.muted }}>
                  {item.description}
                </Typography>
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{ color: darkTheme.text.muted, flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {formatRelativeTime(item.timestamp)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

const gridSx = {
  display: "grid",
  gap: 3,
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
} as const;

const halfGridSx = {
  display: "grid",
  gap: 3,
  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
} as const;

function DashboardSkeleton() {
  return (
    <Stack spacing={3}>
      <Box sx={gridSx}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: radius.lg, bgcolor: "rgba(255,255,255,0.04)" }} />
        ))}
      </Box>
      <Box sx={halfGridSx}>
        {[0, 1].map((i) => (
          <Skeleton key={i} variant="rounded" height={300} sx={{ borderRadius: radius.lg, bgcolor: "rgba(255,255,255,0.04)" }} />
        ))}
      </Box>
      <Box sx={halfGridSx}>
        {[0, 1].map((i) => (
          <Skeleton key={i} variant="rounded" height={280} sx={{ borderRadius: radius.lg, bgcolor: "rgba(255,255,255,0.04)" }} />
        ))}
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

const Dashboard = () => {
  const { data, loading, error, refresh } = useDashboard();

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (loading && !data) return <DashboardSkeleton />;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: darkTheme.text.primary }}>
          Dashboard
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} size="small" sx={{ color: darkTheme.text.secondary }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {data && <DashboardContent data={data} />}
    </Box>
  );
};

function DashboardContent({ data }: { data: DashboardData }) {
  const { metrics, severityDistribution, trend, topProducts, recentActivity } = data;

  return (
    <Stack spacing={3}>
      {/* Row 1: KPI Cards */}
      <Box sx={gridSx}>
        <KpiCard
          label="Open Findings"
          value={metrics.totalOpenFindings}
          icon={<ShieldIcon sx={{ fontSize: 32 }} />}
          color={primitives.jade[500]}
        />
        <KpiCard
          label="Critical + High"
          value={metrics.criticalHighFindings}
          icon={<WarningAmberIcon sx={{ fontSize: 32 }} />}
          color={semantic.severity.high.base}
        />
        <KpiCard
          label="Fixed This Week"
          value={metrics.fixedThisWeek}
          icon={<CheckCircleIcon sx={{ fontSize: 32 }} />}
          color={semantic.status.resolved.base}
        />
        <KpiCard
          label="Products at Risk"
          value={metrics.productsAtRisk}
          icon={<TrendingUpIcon sx={{ fontSize: 32 }} />}
          color={primitives.gold[500]}
        />
      </Box>

      {/* Row 2: Charts */}
      <Box sx={halfGridSx}>
        <TrendChart data={trend} />
        <SeverityChart data={severityDistribution} />
      </Box>

      {/* Row 3: Lists */}
      <Box sx={halfGridSx}>
        <TopProductsList products={topProducts} />
        <RecentActivityList items={recentActivity} />
      </Box>
    </Stack>
  );
}

export default Dashboard;
