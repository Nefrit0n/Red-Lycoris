import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Drawer,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import RefreshIcon from "@mui/icons-material/Refresh";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchImportJobDetail } from "../clients/importJobsClient";
import { ImportJobDetail as ImportJobDetailType } from "../types/imports";

const STATUS_CONFIG: Record<
  string,
  { color: "default" | "primary" | "success" | "error" | "warning"; icon: React.ReactElement; label: string }
> = {
  pending: { color: "default", icon: <PendingIcon />, label: "Ожидает" },
  processing: { color: "primary", icon: <AutorenewIcon className="spin" />, label: "Обработка" },
  completed: { color: "success", icon: <CheckCircleIcon />, label: "Завершено" },
  failed: { color: "error", icon: <ErrorIcon />, label: "Ошибка" },
};

const POLL_INTERVAL = 3000; // 3 seconds

interface LogEntry {
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
}

// Simulated logs for demo - in production this would come from the API
const generateMockLogs = (status: string, createdAt: string): LogEntry[] => {
  const logs: LogEntry[] = [
    { timestamp: createdAt, level: "info", message: "Import job created" },
  ];

  if (status !== "pending") {
    logs.push({ timestamp: createdAt, level: "info", message: "Starting file parsing..." });
    logs.push({ timestamp: createdAt, level: "debug", message: "Validating scanner format" });
    logs.push({ timestamp: createdAt, level: "info", message: "File format validated successfully" });
  }

  if (status === "processing") {
    logs.push({ timestamp: new Date().toISOString(), level: "info", message: "Processing findings..." });
  }

  if (status === "completed") {
    logs.push({ timestamp: createdAt, level: "info", message: "Processing findings..." });
    logs.push({ timestamp: createdAt, level: "info", message: "Deduplicating findings..." });
    logs.push({ timestamp: createdAt, level: "info", message: "Import completed successfully" });
  }

  if (status === "failed") {
    logs.push({ timestamp: createdAt, level: "error", message: "Import failed: Invalid file format" });
  }

  return logs;
};

const LogsViewer = ({ logs, onClose }: { logs: LogEntry[]; onClose: () => void }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "#f44336";
      case "warning":
        return "#ff9800";
      case "info":
        return "#2196f3";
      case "debug":
        return "#9e9e9e";
    }
  };

  return (
    <Drawer anchor="right" open onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 500 } } }}>
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <TerminalIcon />
            <Typography variant="h6">Логи импорта</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            bgcolor: "#1e1e1e",
            p: 2,
            fontFamily: "monospace",
            fontSize: "0.8rem",
          }}
        >
          {logs.map((log, index) => (
            <Box key={index} sx={{ mb: 0.5 }}>
              <Typography
                component="span"
                sx={{ color: "#6a9955", fontSize: "inherit", fontFamily: "inherit" }}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </Typography>{" "}
              <Typography
                component="span"
                sx={{ color: getLevelColor(log.level), fontSize: "inherit", fontFamily: "inherit" }}
              >
                [{log.level.toUpperCase()}]
              </Typography>{" "}
              <Typography
                component="span"
                sx={{ color: "#d4d4d4", fontSize: "inherit", fontFamily: "inherit" }}
              >
                {log.message}
              </Typography>
            </Box>
          ))}
          <div ref={logsEndRef} />
        </Box>
      </Box>
    </Drawer>
  );
};

const ImportJobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ImportJobDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal, silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await fetchImportJobDetail(id, signal);
        setData(response);

        // Stop polling if job is complete
        if (response.status === "completed" || response.status === "failed") {
          setIsPolling(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Не удалось загрузить импорт.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id]
  );

  // Initial fetch
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // Auto-polling for pending/processing jobs
  useEffect(() => {
    if (!data) return;

    const shouldPoll = data.status === "pending" || data.status === "processing";

    if (shouldPoll && !pollIntervalRef.current) {
      setIsPolling(true);
      pollIntervalRef.current = setInterval(() => {
        fetchData(undefined, true);
      }, POLL_INTERVAL);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [data?.status, fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  const handleViewFindings = () => {
    navigate({
      pathname: "/findings",
      search: `?import_job_id=${id}`,
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{error || "Импорт не найден"}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/imports")} sx={{ mt: 2 }}>
          Назад к импортам
        </Button>
      </Container>
    );
  }

  const statusConfig = STATUS_CONFIG[data.status] || STATUS_CONFIG.pending;
  const isActive = data.status === "pending" || data.status === "processing";
  const logs = generateMockLogs(data.status, data.createdAt);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {/* Add CSS for spinning animation */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/imports")} sx={{ mb: 1 }}>
          Назад к импортам
        </Button>

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" component="h1">
              Import Job
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              ID: {data.id}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Обновить">
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button startIcon={<TerminalIcon />} variant="outlined" onClick={() => setShowLogs(true)}>
              Логи
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Status Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Chip
            icon={statusConfig.icon}
            label={statusConfig.label}
            color={statusConfig.color}
            sx={{ fontWeight: 600 }}
          />
          {isPolling && (
            <Typography variant="caption" color="text.secondary">
              Автообновление каждые 3 сек
            </Typography>
          )}
        </Stack>

        {isActive && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant={data.status === "processing" ? "indeterminate" : "determinate"}
              value={0}
            />
          </Box>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">
              Сканер
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {data.scanner}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">
              Продукт
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {data.productName || "—"}
              {data.productVersion && ` v${data.productVersion}`}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">
              Создан
            </Typography>
            <Typography variant="body1">
              {new Date(data.createdAt).toLocaleString("ru-RU")}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">
              Завершён
            </Typography>
            <Typography variant="body1">
              {data.finishedAt ? new Date(data.finishedAt).toLocaleString("ru-RU") : "—"}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Results */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" gutterBottom>
          Результаты
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={6} sm={3}>
            <Paper
              sx={{
                p: 2,
                textAlign: "center",
                bgcolor: "action.hover",
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" fontWeight={600} color="primary">
                {data.findingsTotal}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Всего находок
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper
              sx={{
                p: 2,
                textAlign: "center",
                bgcolor: "action.hover",
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" fontWeight={600} color="success.main">
                {data.findingsNew}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Новых
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper
              sx={{
                p: 2,
                textAlign: "center",
                bgcolor: "action.hover",
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" fontWeight={600} color="warning.main">
                {data.duplicatesTotal}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Дубликатов
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper
              sx={{
                p: 2,
                textAlign: "center",
                bgcolor: "action.hover",
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" fontWeight={600}>
                {data.findingsTotal > 0
                  ? `${Math.round((data.findingsNew / data.findingsTotal) * 100)}%`
                  : "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Новых %
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {data.errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {data.errorMessage}
          </Alert>
        )}
      </Paper>

      {/* Actions */}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={handleViewFindings} disabled={data.findingsTotal === 0}>
          Посмотреть findings ({data.findingsTotal})
        </Button>
        <Button variant="outlined" onClick={() => navigate("/scans/upload")}>
          Загрузить ещё
        </Button>
      </Stack>

      {/* Logs Drawer */}
      {showLogs && <LogsViewer logs={logs} onClose={() => setShowLogs(false)} />}
    </Container>
  );
};

export default ImportJobDetail;
