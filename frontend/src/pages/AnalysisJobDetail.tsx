import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AnalysisJob,
  downloadAnalysisArtifact,
  fetchAnalysisJob,
  SCANNER_CATALOG,
} from "../api/analysisJobs";

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

const AUTO_REFRESH_INTERVAL = 5_000;

const AnalysisJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  if (!id) {
    return (
      <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }}>
        <Alert severity="error">ID анализа не задан.</Alert>
      </Box>
    );
  }

  const jobStatus = job ? STATUS_CONFIG[job.status] || { label: job.status, color: "default" as const } : null;

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} sx={{ maxWidth: 1000, mx: "auto" }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="text" onClick={() => navigate("/analyze")}>
              Назад
            </Button>
            <Typography variant="h5">
              Анализ #{id.slice(0, 8)}
            </Typography>
            {jobStatus && (
              <Chip label={jobStatus.label} color={jobStatus.color} size="small" />
            )}
          </Stack>
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
                  gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }}
                  gap={2}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">Продукт</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {job.productName || job.productId || "—"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Создан</Typography>
                    <Typography variant="body2">
                      {new Date(job.createdAt).toLocaleString("ru-RU")}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Длительность</Typography>
                    <Typography variant="body2">
                      {job.durationSeconds ? `${Math.round(job.durationSeconds)} сек` : "—"}
                    </Typography>
                  </Box>
                  <Box>
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
                  <Typography variant="subtitle1">Сканеры</Typography>
                  <Divider />
                  {job.scannerDetails && job.scannerDetails.length > 0 ? (
                    job.scannerDetails.map((s) => {
                      const sCfg = STATUS_CONFIG[s.status] || { label: s.status, color: "default" as const };
                      return (
                        <Stack
                          key={s.scanner}
                          direction={{ xs: "column", sm: "row" }}
                          spacing={2}
                          alignItems={{ sm: "center" }}
                          justifyContent="space-between"
                          sx={{
                            py: 1.5,
                            borderBottom: "1px solid",
                            borderColor: "divider",
                            "&:last-child": { borderBottom: "none" },
                          }}
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
                            {s.errorMessage && (
                              <Tooltip title={s.errorMessage} arrow>
                                <Chip label="Ошибка" size="small" color="error" variant="outlined" />
                              </Tooltip>
                            )}
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
                        <Stack
                          key={scanner}
                          direction="row"
                          spacing={2}
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ py: 1 }}
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
                  {job.findingsTotal > 0 && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate("/findings")}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      Перейти к находкам
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Error message */}
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
