import {
  Box,
  Chip,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnalysisJob, SCANNER_CATALOG } from "../../../api/analysisJobs";

type RecentAnalysesProps = {
  jobs: AnalysisJob[];
  loading: boolean;
  error?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: "default" | "warning" | "info" | "success" | "error" }> = {
  queued: { label: "В очереди", color: "warning" },
  processing: { label: "В работе", color: "info" },
  succeeded: { label: "Успешно", color: "success" },
  failed: { label: "Ошибка", color: "error" },
};

const COLUMN_LABELS = ["ID", "Продукт", "Сканеры", "Находки", "Статус", "Время", "Создан"];
const SKELETON_ROW_COUNT = 5;

const shortId = (id: string) => id.slice(0, 8);

const scannerLabel = (id: string) => {
  const info = SCANNER_CATALOG.find((s) => s.id === id);
  return info?.name || id;
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return null;
  if (seconds < 60) return `${Math.round(seconds)} сек`;
  return `${Math.round(seconds / 60)} мин`;
};

const TableHead = () => (
  <Box component="thead" sx={{ backgroundColor: "action.hover" }}>
    <Box component="tr">
      {COLUMN_LABELS.map((label) => (
        <Box
          component="th"
          key={label}
          sx={{ textAlign: "left", px: 2, py: 1.5, fontWeight: 600, fontSize: 13 }}
        >
          {label}
        </Box>
      ))}
    </Box>
  </Box>
);

const SkeletonRows = () => (
  <>
    {Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
      <Box
        component="tr"
        key={`skeleton-${rowIndex}`}
        sx={{ borderTop: "1px solid", borderColor: "divider" }}
      >
        {COLUMN_LABELS.map((col) => (
          <Box component="td" key={col} sx={{ px: 2, py: 1.5 }}>
            <Skeleton variant="text" width={col === "ID" ? 64 : col === "Статус" ? 80 : col === "Сканеры" ? 120 : "60%"} />
          </Box>
        ))}
      </Box>
    ))}
  </>
);

const RecentAnalyses = ({ jobs, loading, error }: RecentAnalysesProps) => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [scannerFilter, setScannerFilter] = useState("all");

  const statusOptions = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.status))),
    [jobs]
  );

  const productOptions = useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .map((job) => job.productName)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [jobs]
  );

  const scannerOptions = useMemo(
    () => Array.from(new Set(jobs.flatMap((job) => job.scanners))),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) {
        return false;
      }
      if (productFilter !== "all" && job.productName !== productFilter) {
        return false;
      }
      if (scannerFilter !== "all" && !job.scanners.includes(scannerFilter)) {
        return false;
      }
      return true;
    });
  }, [jobs, productFilter, scannerFilter, statusFilter]);

  const hasActiveFilters =
    statusFilter !== "all" || productFilter !== "all" || scannerFilter !== "all";

  const resetFilters = () => {
    setStatusFilter("all");
    setProductFilter("all");
    setScannerFilter("all");
  };

  const showFilters = jobs.length > 0;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="subtitle1">Последние анализы</Typography>
        {showFilters && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Select
              size="small"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <MenuItem value="all">Все статусы</MenuItem>
              {statusOptions.map((status) => (
                <MenuItem key={status} value={status}>
                  {STATUS_CONFIG[status]?.label || status}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <MenuItem value="all">Все продукты</MenuItem>
              {productOptions.map((product) => (
                <MenuItem key={product} value={product}>
                  {product}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={scannerFilter}
              onChange={(event) => setScannerFilter(event.target.value)}
            >
              <MenuItem value="all">Все сканеры</MenuItem>
              {scannerOptions.map((scanner) => (
                <MenuItem key={scanner} value={scanner}>
                  {scannerLabel(scanner)}
                </MenuItem>
              ))}
            </Select>
          </Stack>
        )}
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", position: "relative", overflow: "hidden" }}>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHead />
          <Box component="tbody">
            {loading ? (
              <SkeletonRows />
            ) : filteredJobs.length === 0 ? (
              <>
                {/* Ghost rows to maintain table width */}
                {Array.from({ length: 3 }).map((_, i) => (
                  <Box
                    component="tr"
                    key={`ghost-${i}`}
                    sx={{ borderTop: "1px solid", borderColor: "divider", opacity: 0.15 }}
                  >
                    {COLUMN_LABELS.map((col) => (
                      <Box component="td" key={col} sx={{ px: 2, py: 1.5 }}>
                        <Box sx={{ height: 20, borderRadius: 0.5, bgcolor: "action.selected" }} />
                      </Box>
                    ))}
                  </Box>
                ))}
                {/* Empty state overlay */}
                <Box component="tr">
                  <Box
                    component="td"
                    colSpan={7}
                    sx={{ position: "relative" }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        top: "-3px", // overlap ghost rows
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
                            Нет анализов по выбранным фильтрам.
                          </Typography>
                          <Typography
                            variant="caption"
                            color="primary.main"
                            sx={{ cursor: "pointer", textDecoration: "underline" }}
                            onClick={resetFilters}
                          >
                            Сбросить фильтры
                          </Typography>
                        </>
                      ) : (
                        <Typography color="text.secondary" variant="body2">
                          Анализов пока нет. Запустите первый анализ выше.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              </>
            ) : (
              filteredJobs.map((item) => {
                const statusCfg = STATUS_CONFIG[item.status] || { label: item.status, color: "default" as const };
                return (
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
                          to={`/analyze/${item.id}`}
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
                      <Chip
                        label={statusCfg.label}
                        size="small"
                        color={statusCfg.color}
                        variant="filled"
                        sx={{
                          ...(item.status === "processing" && {
                            animation: "pulse 1.5s ease-in-out infinite",
                            "@keyframes pulse": {
                              "0%, 100%": { opacity: 1 },
                              "50%": { opacity: 0.6 },
                            },
                          }),
                        }}
                      />
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatDuration(item.durationSeconds) || "—"}
                      </Typography>
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(item.createdAt).toLocaleString("ru-RU")}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Paper>

      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}
    </Stack>
  );
};

export default RecentAnalyses;
