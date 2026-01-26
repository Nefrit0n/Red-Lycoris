import {
  Alert,
  Box,
  Chip,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  BugReport as BugReportIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  InfoOutlined as InfoOutlinedIcon,
} from "@mui/icons-material";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardData, fetchRiskMetrics } from "../api/dashboard";
import { DashboardData, RiskMetricsDTO } from "../types/dashboard";
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
  RiskTrendChart,
  RiskTrendDataPoint,
} from "../components/charts";
import { ProductAutocomplete } from "../components/ProductAutocomplete";
import { RISK_BAND_COLORS, RISK_BAND_LABELS, SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetricsDTO | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [riskProductId, setRiskProductId] = useState("");
  const [riskStatus, setRiskStatus] = useState("");
  const [riskFrom, setRiskFrom] = useState("");
  const [riskTo, setRiskTo] = useState("");

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

  const fetchRiskData = useCallback(
    async (signal?: AbortSignal) => {
      setRiskLoading(true);
      setRiskError(null);
      try {
        const response = await fetchRiskMetrics(
          {
            productId: riskProductId,
            from: riskFrom,
            to: riskTo,
            status: riskStatus,
          },
          signal
        );
        setRiskMetrics(response);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Risk metrics fetch error:", err);
          setRiskError("Не удалось загрузить risk метрики.");
          setRiskMetrics(null);
        }
      } finally {
        setRiskLoading(false);
      }
    },
    [riskProductId, riskFrom, riskTo, riskStatus]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRiskData(controller.signal);
    return () => controller.abort();
  }, [fetchRiskData]);

  const handleRefresh = () => {
    fetchData();
    fetchRiskData();
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

  const riskTrendData: RiskTrendDataPoint[] = riskMetrics?.trend
    ? riskMetrics.trend.map((point) => ({
        date: point.date,
        avgRisk: Math.round(point.avgRisk),
        criticalCount: point.criticalCount,
      }))
    : [];

  const riskBands = riskMetrics?.bands ?? {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const riskBandEntries = [
    { key: "critical", label: RISK_BAND_LABELS.critical, count: riskBands.critical },
    { key: "high", label: RISK_BAND_LABELS.high, count: riskBands.high },
    { key: "medium", label: RISK_BAND_LABELS.medium, count: riskBands.medium },
    { key: "low", label: RISK_BAND_LABELS.low, count: riskBands.low },
  ] as const;
  const riskTotal = riskBandEntries.reduce((sum, entry) => sum + entry.count, 0);

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
          <Typography
            variant="h4"
            component="h1"
            fontWeight={700}
            sx={{
              background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Обзор безопасности приложений
          </Typography>
        </Box>
        <Tooltip title="Обновить данные">
          <IconButton
            onClick={handleRefresh}
            disabled={loading}
            sx={{
              color: "text.secondary",
              bgcolor: "rgba(255,255,255,0.05)",
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.1)",
              },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
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
      <Grid container spacing={3} sx={{ "& > .MuiGrid-item": { display: "flex" } }}>
        <Grid item xs={12} md={4}>
          <Box sx={{ width: "100%", minHeight: 320 }}>
            <StatusBarChart
              data={statusData}
              title="По статусу"
              loading={loading}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ width: "100%", minHeight: 320 }}>
            <TopProductsChart
              data={topProductsData}
              title="Продукты по риску"
              loading={loading}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ width: "100%", minHeight: 320 }}>
            <RecentActivity
              data={activityData}
              title="Последняя активность"
              loading={loading}
            />
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h5" fontWeight={600}>
              Risk analytics
            </Typography>
            <Tooltip title="Risk uses Likelihood × Impact + asset context">
              <InfoOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            </Tooltip>
          </Stack>
        </Stack>

        <Paper
          sx={{
            p: 2.5,
            mb: 3,
            background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <ProductAutocomplete value={riskProductId} onChange={setRiskProductId} />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl size="small" fullWidth>
                <InputLabel id="risk-status-label">Статус</InputLabel>
                <Select
                  labelId="risk-status-label"
                  label="Статус"
                  value={riskStatus}
                  onChange={(event) => setRiskStatus(event.target.value)}
                >
                  <MenuItem value="">
                    <em>Все</em>
                  </MenuItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                label="From"
                type="date"
                size="small"
                fullWidth
                value={riskFrom}
                onChange={(event) => setRiskFrom(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                label="To"
                type="date"
                size="small"
                fullWidth
                value={riskTo}
                onChange={(event) => setRiskTo(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Paper>

        {riskError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {riskError}
          </Alert>
        )}

        <Grid container spacing={3} sx={{ "& > .MuiGrid-item": { display: "flex" } }}>
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                width: "100%",
                minHeight: 280,
                background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Risk distribution
              </Typography>
              {riskLoading ? (
                <Box sx={{ mt: 2 }}>
                  {riskBandEntries.map((entry) => (
                    <Box key={entry.key} sx={{ mb: 1.5 }}>
                      <Skeleton variant="text" width="40%" />
                      <Skeleton variant="rectangular" height={10} />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  {riskBandEntries.map((entry) => {
                    const percent = riskTotal > 0 ? (entry.count / riskTotal) * 100 : 0;
                    return (
                      <Box key={entry.key}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {entry.label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {entry.count}
                          </Typography>
                        </Stack>
                        <Box
                          sx={{
                            mt: 0.5,
                            height: 8,
                            borderRadius: 999,
                            bgcolor: "rgba(255,255,255,0.08)",
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              height: "100%",
                              width: `${percent}%`,
                              bgcolor: RISK_BAND_COLORS[entry.key],
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                  {!riskTotal && (
                    <Typography variant="body2" color="text.secondary">
                      Нет данных по рискам.
                    </Typography>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                width: "100%",
                minHeight: 280,
                background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Top 10 risky findings
              </Typography>
              {riskLoading ? (
                <Stack spacing={1}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} variant="rectangular" height={24} />
                  ))}
                </Stack>
              ) : riskMetrics?.topFindings?.length ? (
                <Stack spacing={1.2}>
                  {riskMetrics.topFindings.map((finding) => (
                    <Stack
                      key={finding.id}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          component={Link}
                          to={`/findings/${finding.id}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {finding.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {SEVERITY_STYLES[finding.severity].label}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`${RISK_BAND_LABELS[finding.riskBand]} ${Math.round(
                          finding.riskScore
                        )}`}
                        sx={{
                          fontWeight: 700,
                          borderColor: RISK_BAND_COLORS[finding.riskBand],
                          color: RISK_BAND_COLORS[finding.riskBand],
                          border: "1px solid",
                        }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Нет risky находок для выбранных фильтров.
                </Typography>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <RiskTrendChart
              data={riskTrendData}
              title="Risk trend"
              loading={riskLoading}
            />
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard;
