import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnalysisJob,
  fetchAnalysisJobs,
  SCANNER_CATALOG,
} from "../api/analysisJobs";
import PaginationControl from "../components/PaginationControl";
import RunBuilderDrawer from "../features/analyze/components/RunBuilderDrawer";
import RunStatusBadge from "../features/analyze/components/RunStatusBadge";

const AUTO_REFRESH_INTERVAL = 10_000;
const SKELETON_ROW_COUNT = 5;
const TABLE_MIN_HEIGHT = 420;

const COLUMN_DEFS = [
  { key: "id", label: "ID", width: 90 },
  { key: "product", label: "Продукт", width: undefined },
  { key: "scanners", label: "Сканеры", width: 200 },
  { key: "findings", label: "Находки", width: 110 },
  { key: "status", label: "Статус", width: 120 },
  { key: "duration", label: "Время", width: 90 },
  { key: "created", label: "Создан", width: 160 },
] as const;

const shortId = (id: string) => id.slice(0, 8);

const scannerLabel = (id: string) => {
  const info = SCANNER_CATALOG.find((s) => s.id === id);
  return info?.name || id;
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return "—";
  if (seconds < 60) return `${Math.round(seconds)} сек`;
  return `${Math.round(seconds / 60)} мин`;
};

const RunsPage = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [data, setData] = useState<AnalysisJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [scannerFilter, setScannerFilter] = useState("all");

  const loadJobs = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAnalysisJobs(pageSize, page * pageSize, signal);
        setData(response.data);
        setTotal(response.total);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Не удалось загрузить список запусков.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs]);

  useEffect(() => {
    const hasRunning = data.some(
      (j) => j.status === "queued" || j.status === "processing",
    );
    if (!hasRunning) return;
    const interval = setInterval(() => {
      loadJobs();
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [data, loadJobs]);

  // Derived filter options
  const statusOptions = useMemo(
    () => Array.from(new Set(data.map((j) => j.status))),
    [data],
  );
  const productOptions = useMemo(
    () =>
      Array.from(
        new Set(data.map((j) => j.productName).filter((v): v is string => Boolean(v))),
      ),
    [data],
  );
  const scannerOptions = useMemo(
    () => Array.from(new Set(data.flatMap((j) => j.scanners))),
    [data],
  );

  const filteredJobs = useMemo(() => {
    return data.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (productFilter !== "all" && job.productName !== productFilter) return false;
      if (scannerFilter !== "all" && !job.scanners.includes(scannerFilter)) return false;
      return true;
    });
  }, [data, statusFilter, productFilter, scannerFilter]);

  const hasActiveFilters =
    statusFilter !== "all" || productFilter !== "all" || scannerFilter !== "all";

  const resetFilters = () => {
    setStatusFilter("all");
    setProductFilter("all");
    setScannerFilter("all");
  };

  const hasEverHadRuns = total > 0 || data.length > 0;
  const showFilters = hasEverHadRuns && !loading;

  const handleRunCreated = useCallback(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h4">Запуски</Typography>
            <Typography variant="body2" color="text.secondary">
              Управляйте анализами безопасности ваших продуктов.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDrawerOpen(true)}
          >
            Новый анализ
          </Button>
        </Stack>

        {/* Filters */}
        {showFilters && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">Все статусы</MenuItem>
              {statusOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s === "queued" ? "В очереди" : s === "processing" ? "В работе" : s === "succeeded" ? "Успешно" : s === "failed" ? "Ошибка" : s}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="all">Все продукты</MenuItem>
              {productOptions.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={scannerFilter}
              onChange={(e) => setScannerFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">Все сканеры</MenuItem>
              {scannerOptions.map((s) => (
                <MenuItem key={s} value={s}>{scannerLabel(s)}</MenuItem>
              ))}
            </Select>
            {hasActiveFilters && (
              <Button size="small" variant="text" onClick={resetFilters}>
                Сбросить
              </Button>
            )}
          </Stack>
        )}

        {/* Table */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
            minHeight: TABLE_MIN_HEIGHT,
            position: "relative",
          }}
        >
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            {/* Fixed thead — always visible */}
            <Box component="thead" sx={{ backgroundColor: "action.hover" }}>
              <Box component="tr">
                {COLUMN_DEFS.map((col) => (
                  <Box
                    component="th"
                    key={col.key}
                    sx={{
                      textAlign: "left",
                      px: 2,
                      py: 1.5,
                      fontWeight: 600,
                      fontSize: 13,
                      ...(col.width ? { width: col.width } : {}),
                    }}
                  >
                    {col.label}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {loading ? (
                <SkeletonRows />
              ) : filteredJobs.length === 0 ? (
                <EmptyState
                  hasActiveFilters={hasActiveFilters}
                  hasEverHadRuns={hasEverHadRuns}
                  onResetFilters={resetFilters}
                  onNewAnalysis={() => setDrawerOpen(true)}
                />
              ) : (
                filteredJobs.map((item) => (
                  <Box
                    component="tr"
                    key={item.id}
                    sx={{
                      borderTop: "1px solid",
                      borderColor: "divider",
                      "&:hover": { backgroundColor: "action.hover" },
                    }}
                  >
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Tooltip title={item.id} arrow>
                        <Typography
                          component={Link}
                          to={`/runs/${item.id}`}
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            textDecoration: "none",
                            color: "primary.main",
                            "&:hover": { textDecoration: "underline" },
                          }}
                        >
                          {shortId(item.id)}
                        </Typography>
                      </Tooltip>
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2">{item.productName || "—"}</Typography>
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {item.scanners.map((s) => (
                          <Chip key={s} label={scannerLabel(s)} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      {item.findingsTotal > 0 ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="body2" fontWeight={600}>
                            {item.findingsTotal}
                          </Typography>
                          {item.findingsNew > 0 && (
                            <Chip label={`+${item.findingsNew}`} size="small" color="error" variant="outlined" />
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <RunStatusBadge status={item.status} />
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatDuration(item.durationSeconds)}
                      </Typography>
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(item.createdAt).toLocaleString("ru-RU")}
                      </Typography>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Paper>

        {error && (
          <Typography color="error" variant="body2">{error}</Typography>
        )}

        <PaginationControl
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(0);
          }}
        />
      </Stack>

      <RunBuilderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={handleRunCreated}
      />
    </Box>
  );
};

/* ---------- Skeleton Rows ---------- */

const SkeletonRows = () => (
  <>
    {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
      <Box
        component="tr"
        key={`skel-${i}`}
        sx={{ borderTop: "1px solid", borderColor: "divider" }}
      >
        {COLUMN_DEFS.map((col) => (
          <Box component="td" key={col.key} sx={{ px: 2, py: 1.5 }}>
            <Skeleton
              variant="text"
              width={
                col.key === "id" ? 64
                : col.key === "status" ? 80
                : col.key === "scanners" ? 120
                : "60%"
              }
            />
          </Box>
        ))}
      </Box>
    ))}
  </>
);

/* ---------- Empty State ---------- */

interface EmptyStateProps {
  hasActiveFilters: boolean;
  hasEverHadRuns: boolean;
  onResetFilters: () => void;
  onNewAnalysis: () => void;
}

const EmptyState = ({
  hasActiveFilters,
  hasEverHadRuns,
  onResetFilters,
  onNewAnalysis,
}: EmptyStateProps) => (
  <>
    {/* Ghost rows to maintain table width & height */}
    {Array.from({ length: 3 }).map((_, i) => (
      <Box
        component="tr"
        key={`ghost-${i}`}
        sx={{ borderTop: "1px solid", borderColor: "divider", opacity: 0.12 }}
      >
        {COLUMN_DEFS.map((col) => (
          <Box component="td" key={col.key} sx={{ px: 2, py: 1.5 }}>
            <Box sx={{ height: 20, borderRadius: 0.5, bgcolor: "action.selected" }} />
          </Box>
        ))}
      </Box>
    ))}
    <Box component="tr">
      <Box component="td" colSpan={COLUMN_DEFS.length} sx={{ position: "relative" }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            top: "-3px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 5,
            gap: 1,
            bgcolor: "background.paper",
            opacity: 0.95,
          }}
        >
          {hasActiveFilters ? (
            <>
              <Typography color="text.secondary" variant="body2">
                Нет запусков по выбранным фильтрам.
              </Typography>
              <Button size="small" variant="text" onClick={onResetFilters}>
                Сбросить фильтры
              </Button>
            </>
          ) : hasEverHadRuns ? (
            <Typography color="text.secondary" variant="body2">
              Запусков на этой странице нет.
            </Typography>
          ) : (
            <>
              <Typography color="text.secondary" variant="body2">
                Запусков ещё не было.
              </Typography>
              <Button size="small" variant="contained" onClick={onNewAnalysis}>
                Запустить первый анализ
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  </>
);

export default RunsPage;
