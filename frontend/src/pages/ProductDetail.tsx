import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SecurityIcon from "@mui/icons-material/Security";
import WarningIcon from "@mui/icons-material/Warning";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { downloadSbom, listProductComponents, listSboms, uploadSbom, listSbomTransitiveExposure } from "../api/sbom";
import { ChartContainer, ChartTooltip, GlassCard, MetricDisplay } from "../design-system/components";
import { tableStyles } from "../design-system/utils/tableStyles";
import { ProductDetail as ProductDetailType } from "../types/products";
import {
  SbomComponentItem,
  SbomIndexStatus,
  SbomItem,
  SbomTransitiveExposureItem,
  SbomTransitiveStatus,
} from "../types/sbom";
import { semantic } from "../design-system/tokens";
import { calculateHealthScore } from "../utils/productHealth";


const SEVERITY_COLORS = {
  critical: semantic.severity.critical.base,
  high: semantic.severity.high.base,
  medium: semantic.severity.medium.base,
  low: semantic.severity.low.base,
  info: semantic.severity.info.base,
};

const STATUS_ICONS: Record<string, React.ReactElement> = {
  completed: <CheckCircleIcon sx={{ color: "success.main" }} />,
  failed: <ErrorIcon sx={{ color: "error.main" }} />,
  processing: <ScheduleIcon sx={{ color: "warning.main" }} />,
};

const formatScanDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const buildSeverityData = (breakdown?: ProductDetailType["severityBreakdown"]) => {
  if (!breakdown) return [];
  return [
    { name: "Critical", value: breakdown.critical, color: SEVERITY_COLORS.critical },
    { name: "High", value: breakdown.high, color: SEVERITY_COLORS.high },
    { name: "Medium", value: breakdown.medium, color: SEVERITY_COLORS.medium },
    { name: "Low", value: breakdown.low, color: SEVERITY_COLORS.low },
    { name: "Info", value: breakdown.info, color: SEVERITY_COLORS.info },
  ];
};

const getTransitiveSeverityColor = (item: SbomTransitiveExposureItem) => {
  if (item.criticalCount > 0) return SEVERITY_COLORS.critical;
  if (item.highCount > 0) return SEVERITY_COLORS.high;
  if (item.mediumCount > 0) return SEVERITY_COLORS.medium;
  if (item.lowCount > 0) return SEVERITY_COLORS.low;
  return SEVERITY_COLORS.info;
};

const getTransitiveSeverityLabel = (item: SbomTransitiveExposureItem) => {
  if (item.criticalCount > 0) return "Critical";
  if (item.highCount > 0) return "High";
  if (item.mediumCount > 0) return "Medium";
  if (item.lowCount > 0) return "Low";
  return "Info";
};

const RecentScansTimeline = ({ scans }: { scans?: ProductDetailType["recentScans"] }) => {
  if (!scans || scans.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        No scans available.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {scans.map((scan) => (
        <Box
          key={scan.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 1.5,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
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
              {formatScanDate(scan.createdAt)}
            </Typography>
          </Box>
          {scan.findingsNew > 0 && (
            <Chip label={`${scan.findingsNew} new`} size="small" color="info" variant="outlined" />
          )}
          {scan.findingsNew === 0 && (
            <Chip label="No new findings" size="small" variant="outlined" />
          )}
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

const formatTransitiveStatus = (
  status?: SbomTransitiveStatus | null
): { label: string; color: "default" | "success" | "warning" | "error" } => {
  if (!status) return { label: "нет данных", color: "default" };

  switch (status.status) {
    case "done":
      return { label: "ready", color: "success" };
    case "processing":
      return { label: "processing", color: "warning" };
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
  const theme = useTheme();
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
  const [transitiveSbom, setTransitiveSbom] = useState<SbomItem | null>(null);
  const [transitiveStatus, setTransitiveStatus] = useState<SbomTransitiveStatus | null>(null);
  const [transitiveFilters, setTransitiveFilters] = useState({
    q: "",
    maxDepth: 25,
  });

  const [transitiveItems, setTransitiveItems] = useState<SbomTransitiveExposureItem[]>([]);
  const [transitiveTotal, setTransitiveTotal] = useState(0);
  const [transitiveLoading, setTransitiveLoading] = useState(false);
  const [transitiveError, setTransitiveError] = useState<string | null>(null);
  const [showTransitiveTable, setShowTransitiveTable] = useState(false);
  const transitiveGraph = useMemo(() => {
    const maxNodes = 120;
    const sorted = [...transitiveItems].sort((a, b) => {
      const scoreA =
        (a.maxCvssScore ?? 0) +
        a.criticalCount * 4 +
        a.highCount * 3 +
        a.mediumCount * 2 +
        a.lowCount;
      const scoreB =
        (b.maxCvssScore ?? 0) +
        b.criticalCount * 4 +
        b.highCount * 3 +
        b.mediumCount * 2 +
        b.lowCount;
      return scoreB - scoreA;
    });
    const trimmed = sorted.slice(0, maxNodes);
    const maxDistance = trimmed.reduce((acc, item) => {
      const distance = item.minDistanceToAnyVuln ?? transitiveFilters.maxDepth;
      return Math.max(acc, distance);
    }, 0);
    const ringCount = Math.min(Math.max(maxDistance, 1), 5);
    const rings = Array.from({ length: ringCount + 1 }, () => [] as SbomTransitiveExposureItem[]);
    trimmed.forEach((item) => {
      const distance = item.minDistanceToAnyVuln ?? ringCount;
      const ringIndex = Math.min(Math.max(distance, 0), ringCount);
      rings[ringIndex].push(item);
    });
    return {
      nodes: trimmed,
      rings,
      ringCount,
      total: transitiveItems.length,
    };
  }, [transitiveItems, transitiveFilters.maxDepth]);

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
      const latestIndexed =
        items.find((x) => x.indexStatus === "done" || x.indexStatus === "indexed") ?? null;
      setTransitiveSbom((prev) => {
        if (!latestIndexed) return null;
        if (!prev) return latestIndexed;
        if (prev.id === latestIndexed.id) return prev;
        return latestIndexed;
      });
    } catch (err) {
      setSbomError(err instanceof Error ? err.message : "Не удалось загрузить SBOM");
    } finally {
      setSbomLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tabIndex !== 0 && tabIndex !== 2) return;
    fetchSboms();
  }, [fetchSboms, tabIndex]);

  const fetchTransitiveExposure = useCallback(async () => {
    if (!transitiveSbom) return;

    setTransitiveLoading(true);
    setTransitiveError(null);
    try {
      const resp = await listSbomTransitiveExposure(transitiveSbom.id, {
        maxDepth: transitiveFilters.maxDepth,
        q: transitiveFilters.q || undefined,
        limit: 200,
        offset: 0,
      });
      setTransitiveStatus(resp.status);
      setTransitiveItems(resp.data.items);
      setTransitiveTotal(resp.data.total);
    } catch (e) {
      setTransitiveError(e instanceof Error ? e.message : "Не удалось загрузить transitive риск");
    } finally {
      setTransitiveLoading(false);
    }
  }, [transitiveSbom, transitiveFilters]);

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

  useEffect(() => {
    if (tabIndex !== 2) return;
    if (!transitiveSbom) return;
    fetchTransitiveExposure();
  }, [tabIndex, transitiveSbom, transitiveFilters, fetchTransitiveExposure]);

  useEffect(() => {
    if (tabIndex !== 2) return;
    if (!transitiveStatus) return;

    const status = transitiveStatus.status;
    if (status !== "pending" && status !== "processing") return;

    const interval = window.setInterval(() => {
      if (!document.hidden) fetchTransitiveExposure();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [tabIndex, transitiveStatus?.status, fetchTransitiveExposure]);

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
  const healthColor =
    healthScore >= 80
      ? theme.palette.success.main
      : healthScore >= 60
        ? theme.palette.info.main
        : healthScore >= 40
          ? theme.palette.warning.main
          : theme.palette.error.main;
  const totalOpenFindings = data.findingsOpenCount;
  const criticalHighCount =
    (data.severityBreakdown?.critical || 0) + (data.severityBreakdown?.high || 0);
  const severityData = buildSeverityData(data.severityBreakdown);
  const pieData = severityData.filter((item) => item.value > 0);
  const hasSeverityData = severityData.some((item) => item.value > 0);
  const latestScan = data.recentScans?.[0];
  const statusChip = formatIndexStatus(indexStatus);
  const transitiveChip = formatTransitiveStatus(transitiveStatus);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/products")}
            sx={{ alignSelf: "flex-start" }}
          >
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
                {data.name}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {data.identifier || "No repository linked"}
                {data.version && ` • v${data.version}`}
              </Typography>
            </Box>
            <Chip
              label={`Health: ${healthScore}%`}
              sx={{
                bgcolor: alpha(healthColor, 0.2),
                color: healthColor,
                border: `1px solid ${alpha(healthColor, 0.4)}`,
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
              value={totalOpenFindings}
              size="small"
              variant="subtle"
              color="warning"
              icon={<BugReportIcon />}
            />
            <MetricDisplay
              title="Critical / High"
              value={criticalHighCount}
              size="small"
              variant="subtle"
              color="error"
              icon={<WarningIcon />}
            />
            <MetricDisplay
              title="Fixed"
              value={data.findingsFixedCount || 0}
              size="small"
              variant="subtle"
              color="success"
              icon={<CheckCircleIcon />}
            />
            <MetricDisplay
              title="False positives"
              value={data.findingsFalsePositiveCount || 0}
              size="small"
              variant="subtle"
              color="default"
              icon={<SecurityIcon />}
            />
          </Box>
        </Box>

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
              title="Severity breakdown"
              subtitle="Distribution by severity tier"
              height={240}
              loadingVariant="bar"
              hasData={hasSeverityData}
              emptyMessage="No open findings"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} layout="vertical" margin={{ left: 40, right: 24 }}>
                  <XAxis type="number" tick={{ fill: theme.palette.text.secondary }} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fill: theme.palette.text.secondary }}
                    axisLine={false}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {severityData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
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
                <Box>
                  <Typography variant="h6">Recent scans</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Latest activity from import jobs.
                  </Typography>
                </Box>
                <RecentScansTimeline scans={data.recentScans} />
                {latestScan && (
                  <Typography variant="caption" color="text.secondary">
                    Latest scan: {formatScanDate(latestScan.createdAt)}
                  </Typography>
                )}
              </Stack>
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassCard variant="subtle" padding="comfortable">
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Actions</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Focus on the most urgent findings.
                  </Typography>
                </Box>
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
                  View all findings ({totalOpenFindings})
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
                  Only Critical / High
                </Button>
                <Button variant="outlined" fullWidth onClick={() => navigate("/scans/upload")}>
                  Upload scan
                </Button>
              </Stack>
            </GlassCard>
          </Grid>
        </Grid>

        <GlassCard variant="subtle" padding="comfortable">
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">SBOM & Components</Typography>
              <Typography variant="body2" color="text.secondary">
                Manage SBOMs, indexed components, and transitive exposure.
              </Typography>
            </Box>
            <Tabs
              value={tabIndex}
              onChange={(_, value) => setTabIndex(value)}
              sx={{ borderBottom: 1, borderColor: "divider" }}
            >
              <Tab label="SBOM" />
              <Tab label="Components" />
              <Tab label="Transitive" />
            </Tabs>
            {tabIndex === 0 && (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Supported formats: CycloneDX, SPDX, SPDX JSON.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                  <Button variant="contained" component="label" disabled={sbomUploading}>
                    {sbomUploading ? "Uploading..." : "Upload SBOM"}
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
                    Refresh list
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
                    No SBOM uploads yet.
                  </Typography>
                ) : (
                  <Box sx={{ overflowX: "auto" }}>
                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                      <Box component="thead">
                        <Box component="tr">
                          {[
                            "File",
                            "Format",
                            "Size",
                            "SHA256",
                            "Indexed",
                            "Components",
                            "Created",
                            "",
                          ].map((label) => (
                            <Box
                              key={label}
                              component="th"
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                                padding: "10px 8px",
                                color: tableStyles.headerText,
                                borderBottom: `1px solid ${tableStyles.cellBorder}`,
                                background: tableStyles.headerBg,
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
                              {item.createdAt ? formatScanDate(item.createdAt) : "—"}
                            </Box>
                            <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleSbomDownload(item)}
                              >
                                Download
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
                    Refresh
                  </Button>
                </Stack>
                {componentsError && <Alert severity="error">{componentsError}</Alert>}
                {componentsLoading ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={20} />
                  </Box>
                ) : components.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No components found.
                  </Typography>
                ) : (
                  <Box sx={{ overflowX: "auto" }}>
                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                      <Box component="thead">
                        <Box component="tr">
                          {["Name", "Version", "Ecosystem", "Direct", "Vulns", "Licenses"].map((label) => (
                            <Box
                              key={label}
                              component="th"
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                                padding: "10px 8px",
                                color: tableStyles.headerText,
                                borderBottom: `1px solid ${tableStyles.cellBorder}`,
                                background: tableStyles.headerBg,
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
                      Total: {componentsTotal}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
            {tabIndex === 2 && (
              <Stack spacing={2}>
                {!transitiveSbom ? (
                  <Alert severity="info">No indexed SBOM available for transitive risk.</Alert>
                ) : (
                  <>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                      <Chip label={`Status: ${transitiveChip.label}`} color={transitiveChip.color} />
                      {transitiveStatus?.updatedAt && (
                        <Typography variant="body2" color="text.secondary">
                          Updated: {formatScanDate(transitiveStatus.updatedAt)}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        SBOM: {transitiveSbom.originalFilename}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total: {transitiveTotal}
                      </Typography>
                    </Stack>

                    {transitiveStatus?.error && <Alert severity="error">{transitiveStatus.error}</Alert>}

                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                      <TextField
                        select
                        label="Max depth"
                        size="small"
                        value={transitiveFilters.maxDepth}
                        onChange={(event) =>
                          setTransitiveFilters((prev) => ({
                            ...prev,
                            maxDepth: Number(event.target.value) || 25,
                          }))
                        }
                        sx={{ width: 140 }}
                      >
                        {[10, 25, 50].map((depth) => (
                          <MenuItem key={depth} value={depth}>
                            {depth}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        label="Search"
                        size="small"
                        value={transitiveFilters.q}
                        onChange={(event) =>
                          setTransitiveFilters((prev) => ({ ...prev, q: event.target.value }))
                        }
                      />

                      <Button variant="outlined" onClick={fetchTransitiveExposure} disabled={transitiveLoading}>
                        Refresh
                      </Button>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={showTransitiveTable}
                            onChange={(event) => setShowTransitiveTable(event.target.checked)}
                          />
                        }
                        label="Table view"
                      />
                    </Stack>

                    {transitiveError && <Alert severity="error">{transitiveError}</Alert>}

                    {transitiveLoading ? (
                      <Box display="flex" justifyContent="center" py={2}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : transitiveItems.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No transitive risk exposure found.
                      </Typography>
                    ) : (
                      <Stack spacing={2}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} lg={8}>
                            <Box
                              sx={{
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: "background.paper",
                                p: 2,
                                minHeight: 480,
                              }}
                            >
                              <Stack spacing={1} sx={{ mb: 1.5 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                  Transitive exposure map
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Showing {transitiveGraph.nodes.length} of {transitiveGraph.total} packages. Rings show
                                  distance from vulnerable packages.
                                </Typography>
                              </Stack>
                              <Box sx={{ width: "100%", height: 420 }}>
                                <svg width="100%" height="100%" viewBox="0 0 800 520">
                                  {Array.from({ length: transitiveGraph.ringCount + 1 }, (_, idx) => (
                                    <circle
                                      key={`ring-${idx}`}
                                      cx={400}
                                      cy={260}
                                      r={90 + idx * 70}
                                      fill="none"
                                      stroke="rgba(148, 163, 184, 0.2)"
                                      strokeDasharray="4 6"
                                    />
                                  ))}
                                  <g>
                                    <circle cx={400} cy={260} r={36} fill={SEVERITY_COLORS.critical} opacity={0.95} />
                                    <text
                                      x={400}
                                      y={255}
                                      textAnchor="middle"
                                      fontSize="10"
                                      fontWeight="700"
                                      fill="#fff"
                                    >
                                      Vulnerable
                                    </text>
                                    <text x={400} y={270} textAnchor="middle" fontSize="10" fill="#fff">
                                      packages
                                    </text>
                                  </g>
                                  {transitiveGraph.rings.map((ringItems, ringIndex) => {
                                    const radius = 90 + ringIndex * 70;
                                    const step = ringItems.length > 0 ? (Math.PI * 2) / ringItems.length : 0;
                                    const offset = ringIndex * 0.6;
                                    return ringItems.map((item, itemIndex) => {
                                      const angle = itemIndex * step + offset;
                                      const x = 400 + radius * Math.cos(angle);
                                      const y = 260 + radius * Math.sin(angle);
                                      const nodeRadius = 6 + Math.min(10, Math.round((item.maxCvssScore ?? 0) / 2));
                                      const fill = getTransitiveSeverityColor(item);
                                      return (
                                        <g key={item.id}>
                                          <line
                                            x1={400}
                                            y1={260}
                                            x2={x}
                                            y2={y}
                                            stroke="rgba(148, 163, 184, 0.3)"
                                            strokeWidth={1}
                                          />
                                          <circle cx={x} cy={y} r={nodeRadius} fill={fill} opacity={0.9}>
                                            <title>
                                              {item.name}
                                              {item.version ? `@${item.version}` : ""} • {getTransitiveSeverityLabel(item)}
                                              {item.minDistanceToAnyVuln != null
                                                ? ` • distance ${item.minDistanceToAnyVuln}`
                                                : ""}
                                            </title>
                                          </circle>
                                        </g>
                                      );
                                    });
                                  })}
                                </svg>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} lg={4}>
                            <Stack spacing={2}>
                              <Box
                                sx={{
                                  borderRadius: 2,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  bgcolor: "background.paper",
                                  p: 2,
                                }}
                              >
                                <Stack spacing={1}>
                                  <Typography variant="subtitle1" fontWeight={600}>
                                    Highlights
                                  </Typography>
                                  {transitiveGraph.nodes.slice(0, 6).map((item) => (
                                    <Stack key={item.id} spacing={0.25}>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Box
                                          sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: getTransitiveSeverityColor(item),
                                          }}
                                        />
                                        <Typography variant="body2" fontWeight={600}>
                                          {item.name}
                                        </Typography>
                                      </Stack>
                                      <Typography variant="caption" color="text.secondary">
                                        {item.version || "—"} • {item.ecosystem || "unknown"} •{" "}
                                        {getTransitiveSeverityLabel(item)}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        CVSS {item.maxCvssScore == null ? "—" : item.maxCvssScore.toFixed(1)} •
                                        Distance {item.minDistanceToAnyVuln ?? "—"}
                                      </Typography>
                                    </Stack>
                                  ))}
                                </Stack>
                              </Box>
                              <Box
                                sx={{
                                  borderRadius: 2,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  bgcolor: "background.paper",
                                  p: 2,
                                }}
                              >
                                <Stack spacing={1}>
                                  <Typography variant="subtitle1" fontWeight={600}>
                                    Legend
                                  </Typography>
                                  {[
                                    { label: "Critical exposure", color: SEVERITY_COLORS.critical },
                                    { label: "High exposure", color: SEVERITY_COLORS.high },
                                    { label: "Medium exposure", color: SEVERITY_COLORS.medium },
                                    { label: "Low exposure", color: SEVERITY_COLORS.low },
                                    { label: "No CVE counts", color: SEVERITY_COLORS.info },
                                  ].map((entry) => (
                                    <Stack key={entry.label} direction="row" spacing={1} alignItems="center">
                                      <Box
                                        sx={{
                                          width: 10,
                                          height: 10,
                                          borderRadius: "50%",
                                          bgcolor: entry.color,
                                        }}
                                      />
                                      <Typography variant="caption" color="text.secondary">
                                        {entry.label}
                                      </Typography>
                                    </Stack>
                                  ))}
                                </Stack>
                              </Box>
                            </Stack>
                          </Grid>
                        </Grid>

                        {showTransitiveTable && (
                          <Box sx={{ overflowX: "auto" }}>
                            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                              <Box component="thead">
                                <Box component="tr">
                                  {["Name", "Version", "Ecosystem", "C/H/M/L", "Max CVSS", "Min distance"].map(
                                    (label) => (
                                      <Box
                                        key={label}
                                        component="th"
                                        style={{
                                          fontWeight: 600,
                                          fontSize: 12,
                                          padding: "10px 8px",
                                          color: tableStyles.headerText,
                                          borderBottom: `1px solid ${tableStyles.cellBorder}`,
                                          background: tableStyles.headerBg,
                                        }}
                                      >
                                        {label}
                                      </Box>
                                    )
                                  )}
                                </Box>
                              </Box>

                              <Box component="tbody">
                                {transitiveItems.map((it) => (
                                  <Box key={it.id} component="tr">
                                    <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                                      <Stack spacing={0.25}>
                                        <Typography variant="body2">{it.name}</Typography>
                                        {it.purl && (
                                          <Typography variant="caption" color="text.secondary">
                                            {it.purl}
                                          </Typography>
                                        )}
                                      </Stack>
                                    </Box>

                                    <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                                      {it.version || "—"}
                                    </Box>

                                    <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                                      {it.ecosystem || "—"}
                                    </Box>

                                    <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                                      <Typography variant="body2">
                                        {it.criticalCount}/{it.highCount}/{it.mediumCount}/{it.lowCount}
                                      </Typography>
                                    </Box>

                                    <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                                      {it.maxCvssScore == null ? "—" : it.maxCvssScore.toFixed(1)}
                                    </Box>

                                    <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                                      {it.minDistanceToAnyVuln ?? "—"}
                                    </Box>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            )}
          </Stack>
        </GlassCard>
      </Stack>
    </Container>
  );
};

export default ProductDetailPage;
