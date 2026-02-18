import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Replay as ReplayIcon,
} from "@mui/icons-material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AnalysisJob,
  createAnalysisJob,
  downloadAnalysisArtifact,
  fetchAnalysisJob,
  SCANNER_CATALOG,
} from "../api/analysisJobs";
import { useNotification } from "../contexts/NotificationContext";
import RunStatusBadge from "../features/analyze/components/RunStatusBadge";

const STATUS_CONFIG: Record<string, { label: string; color: "default" | "warning" | "info" | "success" | "error" }> = {
  queued: { label: "В очереди", color: "warning" },
  processing: { label: "В работе", color: "info" },
  succeeded: { label: "Успешно", color: "success" },
  failed: { label: "Ошибка", color: "error" },
  pending: { label: "Ожидание", color: "default" },
  running: { label: "Выполняется", color: "info" },
};

const scannerDisplayName = (id: string) => {
  const info = SCANNER_CATALOG.find((s) => s.id === id);
  return info?.name || id;
};

const formatDuration = (ms?: number) => {
  if (!ms) return null;
  if (ms < 1000) return `${ms} мс`;
  const sec = ms / 1000;
  if (sec < 60) return `${Math.round(sec)} сек`;
  return `${Math.round(sec / 60)} мин`;
};

const formatLogTime = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ru-RU");
};

const formatElapsed = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const AUTO_REFRESH_INTERVAL = 5_000;
const ERROR_TRUNCATE_LENGTH = 200;

const AnalysisJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError: showNotifError } = useNotification();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState<number>(0);
  const [rerunning, setRerunning] = useState(false);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAnalysisJob(id);
      setJob(response);
    } catch {
      setError("Не удалось загрузить анализ.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  // Auto-refresh for running jobs
  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "processing")) return;
    const interval = setInterval(loadJob, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [job, loadJob]);

  // Elapsed timer for active jobs
  useEffect(() => {
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    if (!job || (job.status !== "processing" && job.status !== "queued")) {
      setElapsed(0);
      return;
    }
    const startTime = job.startedAt ? new Date(job.startedAt).getTime() : Date.now();
    const tick = () => setElapsed(Date.now() - startTime);
    tick();
    elapsedRef.current = setInterval(tick, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [job]);

  const handleDownload = async (artifact: string) => {
    if (!id) return;
    setDownloadError(null);
    try {
      const blob = await downloadAnalysisArtifact(id, artifact);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `result_${artifact}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Не удалось скачать артефакт");
    }
  };

  const handleCopyError = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // fallback: ignore silently
    }
  };

  const toggleErrorExpand = (scanner: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(scanner)) {
        next.delete(scanner);
      } else {
        next.add(scanner);
      }
      return next;
    });
  };

  const handleRerun = useCallback(async () => {
    if (!job || rerunning) return;
    setRerunning(true);
    try {
      const response = await createAnalysisJob({
        productId: job.productId || "",
        scanners: job.scanners,
        sourceMode: job.sourceKind === "snapshot" ? "latest" : undefined,
        sourceSnapshotId: job.sourceSnapshotId,
        idempotencyKey: crypto.randomUUID(),
      });
      showSuccess("Повторный анализ поставлен в очередь.");
      navigate(`/runs/${response.id}`);
    } catch (err) {
      showNotifError(err instanceof Error ? err.message : "Не удалось повторить анализ");
    } finally {
      setRerunning(false);
    }
  }, [job, navigate, rerunning, showNotifError, showSuccess]);

  if (!id) {
    return (
      <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }}>
        <Alert severity="error">ID анализа не задан.</Alert>
      </Box>
    );
  }

  const jobStatus = job ? STATUS_CONFIG[job.status] || { label: job.status, color: "default" as const } : null;

  // Scanner progress metrics
  const scannerDetails = job?.scannerDetails ?? [];
  const completedScanners = scannerDetails.filter(
    (s) => s.status === "succeeded" || s.status === "failed"
  ).length;
  const totalScanners = scannerDetails.length;
  const activeScannerName = scannerDetails.find(
    (s) => s.status === "running" || s.status === "processing"
  );
  const isLive = job?.status === "processing" || job?.status === "queued";

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} sx={{ maxWidth: 1000, mx: "auto" }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="text" onClick={() => navigate("/runs")}>
              Назад
            </Button>
            <Typography variant="h5">
              Анализ #{id.slice(0, 8)}
            </Typography>
            {job && <RunStatusBadge status={job.status} />}
            {isLive && elapsed > 0 && (
              <Typography variant="caption" color="text.secondary">
                {formatElapsed(elapsed)}
              </Typography>
            )}
          </Stack>
          {job && !isLive && (
            <Button
              variant="outlined"
              size="small"
              startIcon={rerunning ? <CircularProgress size={14} /> : <ReplayIcon />}
              disabled={rerunning || !job.productId}
              onClick={handleRerun}
            >
              Повторить
            </Button>
          )}
        </Stack>

        {loading && !job && (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {job && (
          <Stack spacing={3}>
            {/* Overview Card */}
            <Card variant="outlined">
              <CardContent>
                <Box
                  display="grid"
                  gridTemplateColumns={{ xs: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }}
                  gap={2}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">Продукт</Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {job.productName || job.productId || "—"}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">Создан</Typography>
                    <Typography variant="body2">
                      {new Date(job.createdAt).toLocaleString("ru-RU")}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">Длительность</Typography>
                    <Typography variant="body2">
                      {job.durationSeconds ? `${Math.round(job.durationSeconds)} сек` : "—"}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">Источник</Typography>
                    <Typography variant="body2">
                      {job.sourceKind === "snapshot" ? "Снапшот" : "Архив (ephemeral)"}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Scanners breakdown */}
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1">Сканеры</Typography>
                    {totalScanners > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {completedScanners} / {totalScanners} завершено
                      </Typography>
                    )}
                  </Stack>

                  {/* Live progress block */}
                  {isLive && totalScanners > 0 && (
                    <Box>
                      <LinearProgress
                        variant="determinate"
                        value={(completedScanners / totalScanners) * 100}
                        sx={{ mb: 0.75, borderRadius: 1 }}
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {formatElapsed(elapsed)} прошло
                        </Typography>
                        {activeScannerName && (
                          <>
                            <Typography variant="caption" color="text.disabled">·</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Сейчас: {scannerDisplayName(activeScannerName.scanner)}
                            </Typography>
                          </>
                        )}
                      </Stack>
                    </Box>
                  )}

                  <Divider />
                  {job.scannerDetails && job.scannerDetails.length > 0 ? (
                    job.scannerDetails.map((s) => {
                      const sCfg = STATUS_CONFIG[s.status] || { label: s.status, color: "default" as const };
                      const logEntries = [
                        s.startedAt && { label: "Запуск сканера", time: formatLogTime(s.startedAt) },
                        s.startedAt && !s.finishedAt && { label: `Выполняется: ${sCfg.label}` },
                        s.finishedAt && { label: `Завершение: ${sCfg.label}`, time: formatLogTime(s.finishedAt) },
                        s.hasArtifact && { label: "Артефакт результата готов" },
                        !s.startedAt && { label: sCfg.label === "В очереди" || sCfg.label === "Ожидание" ? "Ожидает запуска" : `Статус: ${sCfg.label}` },
                      ].filter(Boolean) as { label: string; time?: string }[];

                      const errorMsg = s.errorMessage ?? null;
                      const isErrorExpanded = expandedErrors.has(s.scanner);
                      const errorTruncated =
                        errorMsg && errorMsg.length > ERROR_TRUNCATE_LENGTH && !isErrorExpanded
                          ? errorMsg.slice(0, ERROR_TRUNCATE_LENGTH) + "…"
                          : errorMsg;

                      return (
                        <Stack
                          key={s.scanner}
                          spacing={1}
                          sx={{
                            py: 1.5,
                            borderBottom: "1px solid",
                            borderColor: "divider",
                            "&:last-child": { borderBottom: "none" },
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                            alignItems={{ sm: "center" }}
                            justifyContent="space-between"
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
                              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 100 }}>
                                {scannerDisplayName(s.scanner)}
                              </Typography>
                              <Chip label={sCfg.label} color={sCfg.color} size="small" variant="filled" />
                              {s.durationMs != null && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatDuration(s.durationMs)}
                                </Typography>
                              )}
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {s.hasArtifact && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleDownload(s.scanner)}
                                >
                                  JSON
                                </Button>
                              )}
                            </Stack>
                          </Stack>

                          {/* Inline error display */}
                          {errorMsg && (
                            <Alert
                              severity="error"
                              variant="outlined"
                              sx={{ py: 0.5 }}
                              action={
                                <Tooltip title="Скопировать">
                                  <Button
                                    size="small"
                                    color="inherit"
                                    sx={{ minWidth: 0, px: 1 }}
                                    onClick={() => handleCopyError(errorMsg)}
                                  >
                                    Копировать
                                  </Button>
                                </Tooltip>
                              }
                            >
                              <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                                {errorTruncated}
                              </Typography>
                              {errorMsg.length > ERROR_TRUNCATE_LENGTH && (
                                <Typography
                                  variant="caption"
                                  color="primary.main"
                                  sx={{ cursor: "pointer", display: "block", mt: 0.5 }}
                                  onClick={() => toggleErrorExpand(s.scanner)}
                                >
                                  {isErrorExpanded ? "Свернуть" : "Показать полностью"}
                                </Typography>
                              )}
                            </Alert>
                          )}

                          <Box sx={{ pl: { sm: 7 } }}>
                            <Typography variant="caption" color="text.secondary">
                              Лог выполнения
                            </Typography>
                            <Stack spacing={0.25} mt={0.5}>
                              {logEntries.map((entry, index) => (
                                <Typography key={`${s.scanner}-log-${index}`} variant="caption" color="text.secondary">
                                  • {entry.label}{entry.time ? ` — ${entry.time}` : ""}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                        </Stack>
                      );
                    })
                  ) : (
                    // Fallback to legacy scanner data
                    job.scanners.map((scanner) => {
                      const legacyStatus =
                        scanner === "semgrep" ? job.semgrepStatus :
                        scanner === "trivy" ? job.trivyStatus : "pending";
                      const sCfg = STATUS_CONFIG[legacyStatus] || { label: legacyStatus, color: "default" as const };
                      const hasArtifact =
                        (scanner === "semgrep" && job.artifactSemgrep) ||
                        (scanner === "trivy" && job.artifactTrivy);
                      return (
                        <Stack key={scanner} spacing={1} sx={{ py: 1 }}>
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Typography variant="body2" fontWeight={600}>
                                {scannerDisplayName(scanner)}
                              </Typography>
                              <Chip label={sCfg.label} color={sCfg.color} size="small" variant="filled" />
                            </Stack>
                            {hasArtifact && (
                              <Button size="small" variant="outlined" onClick={() => handleDownload(scanner)}>
                                JSON
                              </Button>
                            )}
                          </Stack>
                          <Box sx={{ pl: { sm: 7 } }}>
                            <Typography variant="caption" color="text.secondary">
                              Лог выполнения
                            </Typography>
                            <Stack spacing={0.25} mt={0.5}>
                              <Typography variant="caption" color="text.secondary">
                                • Статус: {sCfg.label}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      );
                    })
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Findings summary */}
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">Находки</Typography>
                  <Stack direction="row" spacing={3}>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{job.findingsTotal}</Typography>
                      <Typography variant="caption" color="text.secondary">Всего</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700} color="error.main">{job.findingsNew}</Typography>
                      <Typography variant="caption" color="text.secondary">Новых</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700} color="text.secondary">{job.duplicatesTotal}</Typography>
                      <Typography variant="caption" color="text.secondary">Дубликатов</Typography>
                    </Box>
                  </Stack>
                  {/* Always rendered to prevent CLS — disabled when no findings */}
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={job.findingsTotal === 0}
                    onClick={() => navigate("/findings")}
                    sx={{
                      alignSelf: "flex-start",
                      opacity: job.findingsTotal === 0 ? 0.4 : 1,
                    }}
                  >
                    {job.findingsTotal > 0 ? "Перейти к находкам" : "Находок нет"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Job-level error message */}
            {job.errorMessage && (
              <Alert severity="error" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {job.errorMessage}
              </Alert>
            )}

            {downloadError && <Alert severity="error">{downloadError}</Alert>}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default AnalysisJobDetail;
