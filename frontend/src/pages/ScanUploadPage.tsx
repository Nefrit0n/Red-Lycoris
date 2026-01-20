import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import HistoryIcon from "@mui/icons-material/History";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFindingDetail, fetchFindings } from "../api/findings";
import { uploadScan, UploadScanResponse } from "../api/scans";
import { Finding, FindingEvidence } from "../types/findings";
import DragDropUpload from "../components/DragDropUpload";

interface UploadHistoryItem extends UploadScanResponse {
  fileName: string;
  scannerType: string;
  uploadedAt: string;
}

const HISTORY_KEY = "lotus_warden_upload_history";
const LAST_UPLOAD_KEY = "lotus_warden_last_upload";

interface FindingPreview extends Finding {
  evidence?: FindingEvidence | null;
}

const STEPS = ["Выбор файла", "Настройка", "Загрузка", "Результаты"];

const SCANNER_INFO: Record<string, { name: string; description: string; formats: string }> = {
  semgrep: {
    name: "Semgrep",
    description: "SAST анализатор кода",
    formats: "JSON",
  },
  trivy: {
    name: "Trivy",
    description: "Сканер контейнеров и зависимостей",
    formats: "JSON",
  },
  zap: {
    name: "OWASP ZAP",
    description: "DAST сканер веб-приложений",
    formats: "JSON",
  },
};

const ScanUploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [scannerType, setScannerType] = useState<string>("");
  const [productName, setProductName] = useState<string>("");
  const [productVersion, setProductVersion] = useState<string>("");
  const [productIdentifier, setProductIdentifier] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFindings, setPreviewFindings] = useState<FindingPreview[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<UploadHistoryItem[]>(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as UploadHistoryItem[];
    } catch {
      return [];
    }
  });

  // Calculate current step
  const activeStep = useMemo(() => {
    if (success) return 3;
    if (loading) return 2;
    if (file && scannerType) return 1;
    return 0;
  }, [file, scannerType, loading, success]);

  const isValid = useMemo(() => {
    return Boolean(file && scannerType);
  }, [file, scannerType]);

  const handleUpload = async () => {
    if (!file || !scannerType) {
      setError("Выберите файл и тип сканера перед загрузкой.");
      return;
    }
    setError(null);
    setSuccess(null);
    setPreviewFindings([]);
    setPreviewTotal(null);
    setPreviewError(null);
    setLoading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const result = await uploadScan({
        file,
        scannerType,
        productName: productName || undefined,
        productVersion: productVersion || undefined,
        productIdentifier: productIdentifier || undefined,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess(result);

      const entry: UploadHistoryItem = {
        ...result,
        fileName: file.name,
        scannerType,
        uploadedAt: new Date().toISOString(),
      };
      const updated = [entry, ...history].slice(0, 10);
      setHistory(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      localStorage.setItem(
        LAST_UPLOAD_KEY,
        JSON.stringify({ productId: result.productId ?? null })
      );
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!success?.importJobId) return;

    const controller = new AbortController();
    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const response = await fetchFindings(
          {
            limit: 10,
            offset: 0,
            canonicalOnly: true,
            includeRepeats: false,
            importJobId: success.importJobId,
          },
          controller.signal
        );

        setPreviewTotal(response.total ?? 0);

        if (!response.data.length) {
          setPreviewFindings([]);
          return;
        }

        const details = await Promise.all(
          response.data.map(async (item) => {
            try {
              const detail = await fetchFindingDetail(item.id, controller.signal);
              return { id: item.id, evidence: detail.evidence ?? null };
            } catch {
              return { id: item.id, evidence: null };
            }
          })
        );

        const evidenceMap = new Map(details.map((detail) => [detail.id, detail.evidence]));
        const withEvidence = response.data.map((item) => ({
          ...item,
          evidence: evidenceMap.get(item.id) ?? null,
        }));
        setPreviewFindings(withEvidence);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setPreviewError("Не удалось загрузить список находок.");
        }
      } finally {
        setPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => controller.abort();
  }, [success?.importJobId]);

  const handleReset = () => {
    setFile(null);
    setScannerType("");
    setProductName("");
    setProductVersion("");
    setProductIdentifier("");
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setPreviewFindings([]);
    setPreviewTotal(null);
  };

  const handleViewFindings = () => {
    const params = new URLSearchParams();
    if (success?.productId) {
      params.set("productId", success.productId);
    }
    navigate({
      pathname: "/findings",
      search: params.toString() ? `?${params.toString()}` : "",
    });
  };

  const handleViewImport = () => {
    if (success?.importJobId) {
      navigate(`/imports/${success.importJobId}`);
    }
  };

  const handleOpenFinding = (id: string) => {
    navigate(`/findings/${id}`);
  };

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} maxWidth="lg" mx="auto">
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h4" gutterBottom>
                Upload Scan
              </Typography>
              <Typography color="text.secondary">
                Загрузите отчёт сканера для создания находок
              </Typography>
            </Box>
            <Button
              startIcon={<HistoryIcon />}
              onClick={() => setShowHistory(!showHistory)}
              variant={showHistory ? "contained" : "outlined"}
              size="small"
            >
              История ({history.length})
            </Button>
          </Stack>
        </Box>

        {/* History Collapse */}
        <Collapse in={showHistory}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Последние загрузки
              </Typography>
              {history.length === 0 ? (
                <Typography color="text.secondary">Пока нет загрузок</Typography>
              ) : (
                <Stack spacing={1}>
                  {history.slice(0, 5).map((entry, index) => (
                    <Paper
                      key={`${entry.scanId}-${entry.uploadedAt}`}
                      sx={{
                        p: 1.5,
                        bgcolor: "action.hover",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {entry.fileName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {SCANNER_INFO[entry.scannerType]?.name || entry.scannerType} ·{" "}
                          {new Date(entry.uploadedAt).toLocaleString("ru-RU")}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={`${entry.createdFindings} находок`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        {entry.duplicates > 0 && (
                          <Chip
                            label={`${entry.duplicates} дубл.`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Collapse>

        {/* Stepper */}
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Main Upload Card */}
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Stack spacing={3}>
              {/* Scanner Selection */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  1. Выберите тип сканера
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(SCANNER_INFO).map(([key, info]) => (
                    <Grid item xs={12} sm={4} key={key}>
                      <Paper
                        onClick={() => !loading && setScannerType(key)}
                        sx={{
                          p: 2,
                          cursor: loading ? "not-allowed" : "pointer",
                          border: "2px solid",
                          borderColor: scannerType === key ? "primary.main" : "divider",
                          bgcolor: scannerType === key ? "action.selected" : "transparent",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            borderColor: loading ? "divider" : "primary.light",
                          },
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={600}>
                          {info.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {info.description}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Формат: {info.formats}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* File Upload */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  2. Загрузите файл отчёта
                </Typography>
                <DragDropUpload
                  onFileSelect={setFile}
                  file={file}
                  accept=".json,.sarif"
                  disabled={loading}
                  uploading={loading}
                  uploadProgress={uploadProgress}
                  uploadComplete={Boolean(success)}
                />
              </Box>

              {/* Advanced Options */}
              <Box>
                <Button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ mb: 1 }}
                >
                  Дополнительные настройки
                </Button>
                <Collapse in={showAdvanced}>
                  <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Укажите информацию о продукте для группировки находок
                    </Typography>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <TextField
                        label="Название продукта"
                        fullWidth
                        size="small"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        disabled={loading}
                      />
                      <TextField
                        label="Версия"
                        fullWidth
                        size="small"
                        value={productVersion}
                        onChange={(e) => setProductVersion(e.target.value)}
                        disabled={loading}
                      />
                    </Stack>
                    <TextField
                      label="Идентификатор продукта"
                      fullWidth
                      size="small"
                      value={productIdentifier}
                      onChange={(e) => setProductIdentifier(e.target.value)}
                      disabled={loading}
                      helperText="Уникальный идентификатор для связи с CI/CD"
                    />
                  </Stack>
                </Collapse>
              </Box>

              {/* Error */}
              {error && <Alert severity="error">{error}</Alert>}

              {/* Success Results */}
              {success && (
                <Box>
                  <Alert
                    severity="success"
                    sx={{ mb: 2 }}
                    action={
                      <Stack direction="row" spacing={1}>
                        <Button
                          color="inherit"
                          size="small"
                          onClick={handleViewFindings}
                          endIcon={<OpenInNewIcon fontSize="small" />}
                        >
                          Все находки
                        </Button>
                        <Button color="inherit" size="small" onClick={handleViewImport}>
                          Детали импорта
                        </Button>
                      </Stack>
                    }
                  >
                    <Typography variant="body2">
                      Загружено успешно! Создано находок: <strong>{success.createdFindings}</strong>
                      {success.duplicates > 0 && (
                        <>, дубликатов: <strong>{success.duplicates}</strong></>
                      )}
                    </Typography>
                  </Alert>

                  {/* Preview */}
                  <Typography variant="subtitle2" gutterBottom>
                    Предпросмотр находок ({previewTotal ?? 0} всего)
                  </Typography>
                  {previewLoading && <LinearProgress sx={{ mb: 1 }} />}
                  {previewError && <Alert severity="error" sx={{ mb: 1 }}>{previewError}</Alert>}
                  {previewTotal === 0 && !previewLoading && (
                    <Alert severity="info">В отчёте не найдено уязвимостей</Alert>
                  )}
                  {previewFindings.length > 0 && (
                    <Stack spacing={1}>
                      {previewFindings.map((finding) => {
                        const path = finding.evidence?.path || "";
                        const startLine = finding.evidence?.start?.line;
                        return (
                          <Paper
                            key={finding.id}
                            sx={{
                              p: 1.5,
                              cursor: "pointer",
                              "&:hover": { bgcolor: "action.hover" },
                            }}
                            onClick={() => handleOpenFinding(finding.id)}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={500} noWrap>
                                  {finding.title}
                                </Typography>
                                {path && (
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {path}
                                    {startLine && `:${startLine}`}
                                  </Typography>
                                )}
                              </Box>
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  label={finding.severity}
                                  size="small"
                                  color={
                                    finding.severity === "critical" || finding.severity === "high"
                                      ? "error"
                                      : finding.severity === "medium"
                                      ? "warning"
                                      : "default"
                                  }
                                />
                                {finding.occurrenceStatus === "REPEAT" && (
                                  <Chip label="Repeat" size="small" variant="outlined" />
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                      {(previewTotal ?? 0) > previewFindings.length && (
                        <Button size="small" onClick={handleViewFindings}>
                          Показать все {previewTotal} находок
                        </Button>
                      )}
                    </Stack>
                  )}
                </Box>
              )}

              {/* Actions */}
              <Stack direction="row" spacing={2}>
                {success ? (
                  <Button variant="contained" onClick={handleReset}>
                    Загрузить ещё
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleUpload}
                    disabled={!isValid || loading}
                    sx={{ minWidth: 150 }}
                  >
                    {loading ? "Загрузка..." : "Загрузить"}
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default ScanUploadPage;
