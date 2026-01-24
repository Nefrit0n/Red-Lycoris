import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SecurityIcon from "@mui/icons-material/Security";
import WarningIcon from "@mui/icons-material/Warning";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { fetchProductDetail } from "../api/products";
import { downloadSbom, listProductComponents, listSboms, uploadSbom } from "../api/sbom";
import { Section } from "../components/Section";
import { ProductDetail as ProductDetailType } from "../types/products";
import { SbomComponentItem, SbomIndexStatus, SbomItem } from "../types/sbom";

const SEVERITY_COLORS = {
  critical: "#f44336",
  high: "#ff9800",
  medium: "#ffeb3b",
  low: "#4caf50",
  info: "#2196f3",
};

const STATUS_ICONS: Record<string, React.ReactElement> = {
  completed: <CheckCircleIcon sx={{ color: "success.main" }} />,
  failed: <ErrorIcon sx={{ color: "error.main" }} />,
  processing: <ScheduleIcon sx={{ color: "warning.main" }} />,
};

const calculateHealthScore = (breakdown?: ProductDetailType["severityBreakdown"]): number => {
  if (!breakdown) return 100;
  const total =
    breakdown.critical + breakdown.high + breakdown.medium + breakdown.low + breakdown.info;
  if (total === 0) return 100;
  const weightedSum =
    breakdown.critical * 10 +
    breakdown.high * 5 +
    breakdown.medium * 2 +
    breakdown.low * 1 +
    breakdown.info * 0.5;
  const maxPenalty = total * 10;
  return Math.max(0, Math.round(100 - (weightedSum / maxPenalty) * 100));
};

const getHealthColor = (score: number): string => {
  if (score >= 80) return "#4caf50";
  if (score >= 60) return "#8bc34a";
  if (score >= 40) return "#ffeb3b";
  if (score >= 20) return "#ff9800";
  return "#f44336";
};

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactElement;
  color?: string;
}

const MetricCard = ({ title, value, icon, color }: MetricCardProps) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      display: "flex",
      alignItems: "center",
      gap: 2,
    }}
  >
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: 2,
        bgcolor: color ? `${color}20` : "action.hover",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: color || "text.secondary",
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="h5" fontWeight={600}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Box>
  </Paper>
);

const SeverityPieChart = ({ breakdown }: { breakdown?: ProductDetailType["severityBreakdown"] }) => {
  if (!breakdown) return null;

  const data = [
    { name: "Critical", value: breakdown.critical, color: SEVERITY_COLORS.critical },
    { name: "High", value: breakdown.high, color: SEVERITY_COLORS.high },
    { name: "Medium", value: breakdown.medium, color: SEVERITY_COLORS.medium },
    { name: "Low", value: breakdown.low, color: SEVERITY_COLORS.low },
    { name: "Info", value: breakdown.info, color: SEVERITY_COLORS.info },
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <SecurityIcon sx={{ fontSize: 48, color: "success.main", mb: 1 }} />
        <Typography color="text.secondary">Нет открытых находок</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

const SeverityBarChart = ({ breakdown }: { breakdown?: ProductDetailType["severityBreakdown"] }) => {
  if (!breakdown) return null;

  const data = [
    { name: "Critical", value: breakdown.critical, fill: SEVERITY_COLORS.critical },
    { name: "High", value: breakdown.high, fill: SEVERITY_COLORS.high },
    { name: "Medium", value: breakdown.medium, fill: SEVERITY_COLORS.medium },
    { name: "Low", value: breakdown.low, fill: SEVERITY_COLORS.low },
    { name: "Info", value: breakdown.info, fill: SEVERITY_COLORS.info },
  ];

  return (
    <Box sx={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={60} />
          <RechartsTooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

const RecentScansTimeline = ({ scans }: { scans?: ProductDetailType["recentScans"] }) => {
  if (!scans || scans.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        Нет данных о сканах.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {scans.map((scan, index) => (
        <Box
          key={scan.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: "action.hover",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {STATUS_ICONS[scan.status] || <ScheduleIcon sx={{ color: "text.secondary" }} />}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {scan.scanner}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(scan.createdAt).toLocaleString("ru-RU")}
            </Typography>
          </Box>
          <Chip
            label={`${scan.findingsNew} новых`}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.7rem" }}
          />
        </Box>
      ))}
    </Stack>
  );
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatIndexStatus = (
  status?: SbomIndexStatus | null
): { label: string; color: "default" | "success" | "warning" | "error" } => {
  if (!status) return { label: "нет SBOM", color: "default" };

  switch (status.status) {
    // backward compatibility (если где-то остались старые значения)
    case "indexed":
    case "done":
      return { label: "ready", color: "success" };

    case "processing":
      return { label: "indexing", color: "warning" };

    case "queued":
    case "pending":
      return { label: "queued", color: "warning" };

    case "failed":
      return { label: "failed", color: "error" };

    default:
      return { label: status.status || "unknown", color: "default" };
  }
};

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProductDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sboms, setSboms] = useState<SbomItem[]>([]);
  const [sbomLoading, setSbomLoading] = useState(false);
  const [sbomError, setSbomError] = useState<string | null>(null);
  const [sbomUploading, setSbomUploading] = useState(false);
  const [sbomUploadError, setSbomUploadError] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [components, setComponents] = useState<SbomComponentItem[]>([]);
  const [componentsTotal, setComponentsTotal] = useState(0);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [componentsFilters, setComponentsFilters] = useState({
    directOnly: false,
    ecosystem: "",
    license: "",
    q: "",
  });
  const [indexStatus, setIndexStatus] = useState<SbomIndexStatus | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const product = await fetchProductDetail(id, signal);
        setData(product);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить продукт.");
        }
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const fetchSboms = useCallback(async () => {
    if (!id) return;
    setSbomLoading(true);
    setSbomError(null);
    try {
      const items = await listSboms(id);
      setSboms(items);
    } catch (err) {
      setSbomError(err instanceof Error ? err.message : "Не удалось загрузить SBOM");
    } finally {
      setSbomLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSboms();
  }, [fetchSboms]);

  const fetchComponents = useCallback(async () => {
    if (!id) return;
    setComponentsLoading(true);
    setComponentsError(null);
    try {
      const response = await listProductComponents(id, {
        directOnly: componentsFilters.directOnly,
        ecosystem: componentsFilters.ecosystem || undefined,
        license: componentsFilters.license || undefined,
        q: componentsFilters.q || undefined,
        limit: 200,
        offset: 0,
      });
      setComponents(response.items);
      setComponentsTotal(response.total);
      setIndexStatus(response.indexStatus ?? null);
    } catch (err) {
      setComponentsError(err instanceof Error ? err.message : "Не удалось загрузить компоненты");
    } finally {
      setComponentsLoading(false);
    }
  }, [componentsFilters, id]);

  useEffect(() => {
    if (tabIndex !== 1) return;
    fetchComponents();
  }, [fetchComponents, tabIndex]);

  useEffect(() => {
    if (tabIndex !== 1) return;
    if (!indexStatus) return;

    const s = indexStatus.status;
    if (s !== "queued" && s !== "processing" && s !== "pending") return;

    const interval = window.setInterval(() => {
      if (!document.hidden) fetchComponents();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [tabIndex, indexStatus?.status, fetchComponents]);

  const handleSbomUpload = async (file: File) => {
    if (!id) return;
    setSbomUploading(true);
    setSbomUploadError(null);
    try {
      await uploadSbom(id, file);
      await fetchSboms();
    } catch (err) {
      setSbomUploadError(err instanceof Error ? err.message : "Не удалось загрузить SBOM");
    } finally {
      setSbomUploading(false);
    }
  };

  const handleSbomDownload = async (item: SbomItem) => {
    try {
      await downloadSbom(item.id, item.originalFilename);
    } catch (err) {
      setSbomError(err instanceof Error ? err.message : "Не удалось скачать SBOM");
    }
  };

  if (!id) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Некорректный ID продукта</Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || "Продукт не найден"}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/products")} sx={{ mt: 2 }}>
          Назад к продуктам
        </Button>
      </Container>
    );
  }

  const healthScore = calculateHealthScore(data.severityBreakdown);
  const healthColor = getHealthColor(healthScore);
  const totalOpenFindings = data.findingsOpenCount;
  const statusChip = formatIndexStatus(indexStatus);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/products")}
          sx={{ mb: 1 }}
        >
          Назад к продуктам
        </Button>

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" component="h1" fontWeight={600}>
              {data.name}
            </Typography>
            {data.identifier && (
              <Typography variant="body1" color="text.secondary">
                {data.identifier}
                {data.version && ` • v${data.version}`}
              </Typography>
            )}
          </Box>

          <Chip
            label={`Health: ${healthScore}%`}
            sx={{
              bgcolor: healthColor,
              color: healthScore >= 40 && healthScore < 80 ? "rgba(0,0,0,0.87)" : "white",
              fontWeight: 700,
              fontSize: "0.875rem",
              px: 1,
            }}
          />
        </Stack>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Открытые находки"
            value={totalOpenFindings}
            icon={<BugReportIcon />}
            color={totalOpenFindings > 0 ? "#ff9800" : "#4caf50"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Critical/High"
            value={
              (data.severityBreakdown?.critical || 0) + (data.severityBreakdown?.high || 0)
            }
            icon={<WarningIcon />}
            color="#f44336"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Исправлено"
            value={data.findingsFixedCount || 0}
            icon={<CheckCircleIcon />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="False Positives"
            value={data.findingsFalsePositiveCount || 0}
            icon={<SecurityIcon />}
            color="#9e9e9e"
          />
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Section title="Распределение по Severity">
            <SeverityPieChart breakdown={data.severityBreakdown} />
          </Section>
        </Grid>
        <Grid item xs={12} md={6}>
          <Section title="Breakdown по Severity">
            <SeverityBarChart breakdown={data.severityBreakdown} />
          </Section>
        </Grid>
      </Grid>

      {/* Recent Scans and Actions */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Section title="Последние сканы">
            <RecentScansTimeline scans={data.recentScans} />
          </Section>
        </Grid>
        <Grid item xs={12} md={6}>
          <Section title="Действия">
            <Stack spacing={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={() =>
                  navigate({
                    pathname: "/findings",
                    search: `?productId=${id}`,
                  })
                }
              >
                Просмотреть все находки ({totalOpenFindings})
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  navigate({
                    pathname: "/findings",
                    search: `?productId=${id}&severity=critical,high`,
                  })
                }
              >
                Только Critical/High
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  navigate({
                    pathname: "/analysis",
                  })
                }
              >
                Запустить новый скан
              </Button>
            </Stack>
          </Section>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Section title="SBOM & Components">
            <Tabs
              value={tabIndex}
              onChange={(_, value) => setTabIndex(value)}
              sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
            >
              <Tab label="SBOM" />
              <Tab label="Components" />
            </Tabs>
            {tabIndex === 0 && (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Поддерживаемые форматы: CycloneDX, SPDX, SPDX JSON.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                  <Button variant="contained" component="label" disabled={sbomUploading}>
                    {sbomUploading ? "Загрузка..." : "Загрузить SBOM"}
                    <input
                      type="file"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          handleSbomUpload(file);
                        }
                        event.target.value = "";
                      }}
                    />
                  </Button>
                  <Button variant="outlined" onClick={fetchSboms} disabled={sbomLoading}>
                    Обновить список
                  </Button>
                </Stack>
                {sbomUploadError && <Alert severity="error">{sbomUploadError}</Alert>}
                {sbomError && <Alert severity="error">{sbomError}</Alert>}
                {sbomLoading ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={20} />
                  </Box>
                ) : sboms.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    SBOM пока не загружены.
                  </Typography>
                ) : (
                  <Box sx={{ overflowX: "auto" }}>
                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                      <Box component="thead">
                        <Box component="tr" sx={{ textAlign: "left" }}>
                          {[
                            "Файл",
                            "Формат",
                            "Размер",
                            "SHA256",
                            "Indexed",
                            "Компоненты",
                            "Дата",
                            "",
                          ].map((label) => (
                            <Box
                              key={label}
                              component="th"
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                                padding: "10px 8px",
                                borderBottom: "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              {label}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {sboms.map((item) => (
                          <Box key={item.id} component="tr">
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.originalFilename}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.format}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {formatBytes(item.sizeBytes)}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                                {item.sha256}
                              </Typography>
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              <Chip
                                size="small"
                                label={item.indexStatus || "pending"}
                                color={
                                  item.indexStatus === "indexed"
                                    ? "success"
                                    : item.indexStatus === "failed"
                                      ? "error"
                                      : "warning"
                                }
                              />
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.componentCount ?? 0}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.createdAt ? new Date(item.createdAt).toLocaleString("ru-RU") : "—"}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleSbomDownload(item)}
                              >
                                Скачать
                              </Button>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Stack>
            )}
            {tabIndex === 1 && (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                  <Chip label={`Status: ${statusChip.label}`} color={statusChip.color} />
                  {indexStatus?.error && (
                    <Typography variant="body2" color="error">
                      {indexStatus.error}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Components: {componentsTotal}
                  </Typography>
                </Stack>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Search"
                    size="small"
                    value={componentsFilters.q}
                    onChange={(event) =>
                      setComponentsFilters((prev) => ({ ...prev, q: event.target.value }))
                    }
                  />
                  <TextField
                    label="Ecosystem"
                    size="small"
                    value={componentsFilters.ecosystem}
                    onChange={(event) =>
                      setComponentsFilters((prev) => ({ ...prev, ecosystem: event.target.value }))
                    }
                  />
                  <TextField
                    label="License contains"
                    size="small"
                    value={componentsFilters.license}
                    onChange={(event) =>
                      setComponentsFilters((prev) => ({ ...prev, license: event.target.value }))
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={componentsFilters.directOnly}
                        onChange={(event) =>
                          setComponentsFilters((prev) => ({
                            ...prev,
                            directOnly: event.target.checked,
                          }))
                        }
                      />
                    }
                    label="Direct only"
                  />
                  <Button variant="outlined" onClick={fetchComponents} disabled={componentsLoading}>
                    Обновить
                  </Button>
                </Stack>
                {componentsError && <Alert severity="error">{componentsError}</Alert>}
                {componentsLoading ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={20} />
                  </Box>
                ) : components.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Компоненты не найдены.
                  </Typography>
                ) : (
                  <Box sx={{ overflowX: "auto" }}>
                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                      <Box component="thead">
                        <Box component="tr" sx={{ textAlign: "left" }}>
                          {["Name", "Version", "Ecosystem", "Direct", "Vulns", "Licenses"].map((label) => (
                            <Box
                              key={label}
                              component="th"
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                                padding: "10px 8px",
                                borderBottom: "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              {label}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {components.map((item) => (
                          <Box key={item.id} component="tr">
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              <Stack spacing={0.5}>
                                <Typography variant="body2">{item.name}</Typography>
                                {item.purl && (
                                  <Typography variant="caption" color="text.secondary">
                                    {item.purl}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.version || "—"}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.ecosystem || "—"}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.direct ? "Yes" : "No"}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {item.vulnTotal > 0 ? (
                                <Stack spacing={0.25}>
                                  <Typography variant="body2">{item.vulnTotal}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    C/H/M/L: {item.vulnCritical}/{item.vulnHigh}/{item.vulnMedium}/{item.vulnLow}
                                  </Typography>
                                </Stack>
                              ) : (
                                "0"
                              )}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              {(item.licenses || []).join(", ") || "—"}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      Всего: {componentsTotal}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Section>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProductDetailPage;
