import {
  Alert,
  Box,
  Container,
  Grid,
  IconButton,
  Typography,
} from "@mui/material";
import {
  BugReport as BugReportIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboardData } from "../api/dashboard";
import { DashboardData } from "../types/dashboard";
import {
  MetricCard,
  SeverityPieChart,
  StatusBarChart,
  TrendLineChart,
  TopProductsChart,
  RecentActivity,
  SeverityData,
  StatusData,
  TrendDataPoint,
  ProductRiskData,
  ActivityItem,
} from "../components/charts";
import { SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#7b1fa2",
  high: "#d32f2f",
  medium: "#ed6c02",
  low: "#2e7d32",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#29b6f6",
  under_review: "#ffa726",
  confirmed: "#66bb6a",
  false_positive: "#78909c",
  out_of_scope: "#78909c",
  risk_accepted: "#ffa726",
  mitigated: "#66bb6a",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDashboardData(signal);
      setData(response);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("Dashboard fetch error:", err);
        setError("Не удалось загрузить данные дашборда.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  // Transform data for charts
  const severityData: SeverityData[] = data
    ? data.severityDistribution.map((d) => ({
        name: SEVERITY_STYLES[d.severity]?.label || d.severity,
        value: d.count,
        color: SEVERITY_COLORS[d.severity] || "#666",
      }))
    : [];

  const statusData: StatusData[] = data
    ? data.statusDistribution
        .filter((d) => d.count > 0)
        .map((d) => ({
          name: STATUS_LABELS[d.status] || d.status,
          value: d.count,
          color: STATUS_COLORS[d.status] || "#666",
        }))
    : [];

  const trendData: TrendDataPoint[] = data
    ? data.trend.map((d) => ({
        date: d.date,
        total: d.total,
        critical: d.critical,
        high: d.high,
        medium: d.medium,
        low: d.low,
      }))
    : [];

  const topProductsData: ProductRiskData[] = data
    ? data.topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        findingsCount: p.findingsCount,
        criticalCount: p.criticalCount,
        highCount: p.highCount,
      }))
    : [];

  const activityData: ActivityItem[] = data
    ? data.recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        severity: a.severity,
        timestamp: a.timestamp,
      }))
    : [];

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Обзор безопасности приложений
          </Typography>
        </Box>
        <IconButton
          onClick={handleRefresh}
          disabled={loading}
          sx={{ color: "text.secondary" }}
          title="Обновить данные"
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Открытые находки"
            value={data?.metrics.totalOpenFindings ?? 0}
            subtitle="требуют внимания"
            icon={<BugReportIcon />}
            color="#7aa2f7"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Critical / High"
            value={data?.metrics.criticalHighFindings ?? 0}
            subtitle="высокий приоритет"
            icon={<WarningIcon />}
            color="#d32f2f"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Исправлено за неделю"
            value={data?.metrics.fixedThisWeek ?? 0}
            subtitle="mitigated"
            icon={<CheckCircleIcon />}
            color="#2e7d32"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Продуктов под угрозой"
            value={data?.metrics.productsAtRisk ?? 0}
            subtitle="с critical/high"
            icon={<SecurityIcon />}
            color="#ed6c02"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <TrendLineChart
            data={trendData}
            title="Динамика находок (30 дней)"
            loading={loading}
            showBreakdown={false}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <SeverityPieChart
            data={severityData}
            title="По критичности"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <StatusBarChart
            data={statusData}
            title="По статусу"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TopProductsChart
            data={topProductsData}
            title="Продукты по риску"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <RecentActivity
            data={activityData}
            title="Последняя активность"
            loading={loading}
          />
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
