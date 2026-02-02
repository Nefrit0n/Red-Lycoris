import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  FormControlLabel,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import HistoryIcon from "@mui/icons-material/History";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ErrorIcon from "@mui/icons-material/Error";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import BatchPredictionIcon from "@mui/icons-material/BatchPrediction";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFindingDetail, fetchFindings } from "../api/findings";
import { uploadScan, UploadScanResponse } from "../api/scans";
import { FindingListItemDTO, FindingEvidence, SemgrepEvidence } from "../types/findings";
import {
  SCANNERS,
  SCANNER_CATEGORIES,
  ScannerCategory,
  ScannerInfo,
  detectScannerFromFile,
  getScannersByCategory,
} from "../types/scanners";
import DragDropUpload, { FileWithValidation } from "../components/DragDropUpload";

interface UploadHistoryItem extends UploadScanResponse {
  fileName: string;
  scannerType: string;
  uploadedAt: string;
}

const HISTORY_KEY = "lotus_warden_upload_history";
const LAST_UPLOAD_KEY = "lotus_warden_last_upload";

interface FindingPreview extends FindingListItemDTO {
  evidence?: FindingEvidence | null;
}

interface BatchUploadResult {
  file: File;
  result?: UploadScanResponse;
  error?: string;
  status: "pending" | "uploading" | "success" | "error";
}

const STEPS = ["Выбор сканера", "Загрузка файла", "Обработка", "Результаты"];
const BATCH_STEPS = ["Загрузка файлов", "Проверка", "Обработка", "Результаты"];

const CATEGORY_ORDER: ScannerCategory[] = ["SAST", "SCA", "DAST", "SECRETS", "CONTAINER", "IAC", "OTHER"];

const getCategoryColor = (category: ScannerCategory): string => {
  switch (category) {
    case "SAST":
      return "#7c4dff";
    case "SCA":
      return "#00bcd4";
    case "DAST":
      return "#ff5722";
    case "SECRETS":
      return "#f44336";
    case "CONTAINER":
      return "#2196f3";
    case "IAC":
      return "#4caf50";
    case "OTHER":
      return "#607d8b";
    default:
      return "#9e9e9e";
  }
};

const getSemgrepEvidence = (evidence?: FindingEvidence | null): SemgrepEvidence | null => {
  if (!evidence || typeof evidence !== "object") return null;
  const scannerType = (evidence as Record<string, unknown>).scannerType;
  if (typeof scannerType === "string" && scannerType !== "semgrep") {
    return null;
  }
  return evidence as SemgrepEvidence;
};

const ScanUploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<FileWithValidation[]>([]);
  const [scannerType, setScannerType] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<ScannerCategory>("SAST");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [productName, setProductName] = useState<string>("");
  const [productVersion, setProductVersion] = useState<string>("");
  const [productIdentifier, setProductIdentifier] = useState<string>("");
  const [customToolName, setCustomToolName] = useState<string>("");
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
  const [autoDetectedScanner, setAutoDetectedScanner] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchUploadResult[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [history, setHistory] = useState<UploadHistoryItem[]>(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as UploadHistoryItem[];
    } catch {
      return [];
    }
  });

  // Auto-detect scanner from file name
  useEffect(() => {
    if (file && !scannerType) {
      const detected = detectScannerFromFile(file.name);
      if (detected) {
        setScannerType(detected);
        // Also switch to the correct category
        const scanner = SCANNERS.find((s) => s.id === detected);
        if (scanner) {
          setSelectedCategory(scanner.category);
        }
      }
    }
  }, [file, scannerType]);

  // Handle auto-detected scanner from content
  const handleScannerDetected = (scannerId: string) => {
    setAutoDetectedScanner(scannerId);
    if (!scannerType || scannerType === "sarif") {
      setScannerType(scannerId);
      const scanner = SCANNERS.find((s) => s.id === scannerId);
      if (scanner) {
        setSelectedCategory(scanner.category);
      }
    }
  };

  // Calculate current step
  const activeStep = useMemo(() => {
    if (batchMode) {
      if (batchResults.some((r) => r.status === "success")) return 3;
      if (batchUploading) return 2;
      if (files.length > 0) return 1;
      return 0;
    }
    if (success) return 3;
    if (loading) return 2;
    if (file && scannerType) return 1;
    return 0;
  }, [file, scannerType, loading, success, batchMode, files, batchResults, batchUploading]);

  const isValid = useMemo(() => {
    if (batchMode) {
      return files.length > 0 && files.every((f) => f.validation?.valid !== false);
    }
    return Boolean(file && scannerType);
  }, [file, scannerType, batchMode, files]);

  // Filter scanners by search query
  const filteredScanners = useMemo(() => {
    if (!searchQuery.trim()) {
      return getScannersByCategory(selectedCategory);
    }
    const query = searchQuery.toLowerCase();
    return SCANNERS.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
    );
  }, [selectedCategory, searchQuery]);

  const selectedScanner = useMemo(() => {
    return SCANNERS.find((s) => s.id === scannerType);
  }, [scannerType]);

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
        customToolName: scannerType === "sarif" ? (customToolName || undefined) : undefined,
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

  const handleBatchUpload = async () => {
    if (files.length === 0) {
      setError("Добавьте файлы для загрузки");
      return;
    }

    const validFiles = files.filter((f) => f.validation?.valid !== false);
    if (validFiles.length === 0) {
      setError("Нет валидных файлов для загрузки");
      return;
    }

    setError(null);
    setBatchUploading(true);

    const results: BatchUploadResult[] = validFiles.map((f) => ({
      file: f.file,
      status: "pending" as const,
    }));
    setBatchResults(results);

    for (let i = 0; i < validFiles.length; i++) {
      const fileData = validFiles[i];
      const scannerForFile = fileData.detectedScanner || detectScannerFromFile(fileData.file.name) || "sarif";

      setBatchResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "uploading" } : r))
      );

      try {
        const result = await uploadScan({
          file: fileData.file,
          scannerType: scannerForFile,
          productName: productName || undefined,
          productVersion: productVersion || undefined,
          productIdentifier: productIdentifier || undefined,
        });

        setBatchResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "success", result } : r))
        );

        // Add to history
        const entry: UploadHistoryItem = {
          ...result,
          fileName: fileData.file.name,
          scannerType: scannerForFile,
          uploadedAt: new Date().toISOString(),
        };
        setHistory((prev) => [entry, ...prev].slice(0, 10));
      } catch (err) {
        setBatchResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "error", error: err instanceof Error ? err.message : "Ошибка" }
              : r
          )
        );
      }
    }

    setBatchUploading(false);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
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
            canonicalOnly: true,
            includeRepeats: false,
            importJobId: success.importJobId,
            includeMeta: true,
          },
          controller.signal
        );

        setPreviewTotal(typeof response.total === "number" ? response.total : response.data.length);

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
    setFiles([]);
    setScannerType("");
    setProductName("");
    setProductVersion("");
    setProductIdentifier("");
    setCustomToolName("");
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setPreviewFindings([]);
    setPreviewTotal(null);
    setAutoDetectedScanner(null);
    setBatchResults([]);
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

  const handleScannerSelect = (scanner: ScannerInfo) => {
    setScannerType(scanner.id);
  };

  const handleCategoryChange = (_: React.SyntheticEvent, newValue: ScannerCategory) => {
    setSelectedCategory(newValue);
    setSearchQuery("");
  };

  const handleFilesSelect = (newFiles: FileWithValidation[]) => {
    setFiles(newFiles);
  };

  // Calculate batch stats
  const batchStats = useMemo(() => {
    const successCount = batchResults.filter((r) => r.status === "success").length;
    const errorCount = batchResults.filter((r) => r.status === "error").length;
    const totalFindings = batchResults
      .filter((r) => r.result)
      .reduce((sum, r) => sum + (r.result?.createdFindings || 0), 0);
    return { successCount, errorCount, totalFindings };
  }, [batchResults]);

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} maxWidth="xl" mx="auto">
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h4" gutterBottom>
                Upload Scan
              </Typography>
              <Typography color="text.secondary">
                Загрузите отчёт сканера безопасности для анализа
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={batchMode}
                    onChange={(e) => {
                      setBatchMode(e.target.checked);
                      handleReset();
                    }}
                    size="small"
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <BatchPredictionIcon fontSize="small" />
                    <Typography variant="body2">Batch</Typography>
                  </Stack>
                }
              />
              <Button
                startIcon={<HistoryIcon />}
                onClick={() => setShowHistory(!showHistory)}
                variant={showHistory ? "contained" : "outlined"}
                size="small"
              >
                История ({history.length})
              </Button>
            </Stack>
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
                  {history.slice(0, 5).map((entry) => {
                    const scanner = SCANNERS.find((s) => s.id === entry.scannerType);
                    return (
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
                            {scanner?.name || entry.scannerType} ·{" "}
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
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Collapse>

        {/* Stepper */}
        <Stepper activeStep={activeStep} alternativeLabel>
          {(batchMode ? BATCH_STEPS : STEPS).map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Main Content */}
        <Grid container spacing={3}>
          {/* Scanner Selection (only in single mode) */}
          {!batchMode && (
            <Grid size={{ xs: 12, md: 7 }}>
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        1. Выберите сканер
                      </Typography>

                      {/* Auto-detected info */}
                      {autoDetectedScanner && (
                        <Alert
                          severity="info"
                          icon={<AutoFixHighIcon />}
                          sx={{ mb: 2 }}
                          action={
                            <Button
                              color="inherit"
                              size="small"
                              onClick={() => {
                                setScannerType(autoDetectedScanner);
                                const scanner = SCANNERS.find((s) => s.id === autoDetectedScanner);
                                if (scanner) setSelectedCategory(scanner.category);
                              }}
                            >
                              Применить
                            </Button>
                          }
                        >
                          Автоопределён сканер:{" "}
                          <strong>{SCANNERS.find((s) => s.id === autoDetectedScanner)?.name || autoDetectedScanner}</strong>
                        </Alert>
                      )}

                      {/* Search */}
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Поиск сканера..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                          startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />,
                        }}
                        sx={{ mb: 2 }}
                      />

                      {/* Category Tabs */}
                      {!searchQuery && (
                        <Tabs
                          value={selectedCategory}
                          onChange={handleCategoryChange}
                          variant="scrollable"
                          scrollButtons="auto"
                          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
                        >
                          {CATEGORY_ORDER.map((cat) => (
                            <Tab
                              key={cat}
                              value={cat}
                              label={
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      bgcolor: getCategoryColor(cat),
                                    }}
                                  />
                                  <span>{SCANNER_CATEGORIES[cat].name}</span>
                                  <Chip
                                    label={getScannersByCategory(cat).length}
                                    size="small"
                                    sx={{ height: 18, fontSize: "0.7rem" }}
                                  />
                                </Stack>
                              }
                            />
                          ))}
                        </Tabs>
                      )}

                      {/* Category Description */}
                      {!searchQuery && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                          {SCANNER_CATEGORIES[selectedCategory].description}
                        </Typography>
                      )}

                      {/* Scanner Grid */}
                      <Grid container spacing={1.5}>
                        {filteredScanners.map((scanner) => (
                          <Grid size={{ xs: 6, sm: 4 }} key={scanner.id}>
                            <Paper
                              onClick={() => !loading && handleScannerSelect(scanner)}
                              sx={{
                                p: 1.5,
                                cursor: loading ? "not-allowed" : "pointer",
                                border: "2px solid",
                                borderColor: scannerType === scanner.id ? "primary.main" : "divider",
                                bgcolor: scannerType === scanner.id ? "action.selected" : "transparent",
                                transition: "all 0.15s ease",
                                position: "relative",
                                "&:hover": {
                                  borderColor: loading ? "divider" : "primary.light",
                                  bgcolor: loading ? "transparent" : "action.hover",
                                },
                              }}
                            >
                              {scannerType === scanner.id && (
                                <CheckCircleIcon
                                  sx={{
                                    position: "absolute",
                                    top: 4,
                                    right: 4,
                                    fontSize: 16,
                                    color: "primary.main",
                                  }}
                                />
                              )}
                              <Stack direction="row" spacing={1} alignItems="flex-start">
                                <Box
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: getCategoryColor(scanner.category),
                                    mt: 0.8,
                                    flexShrink: 0,
                                  }}
                                />
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={600} noWrap>
                                    {scanner.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {scanner.description}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>

                      {filteredScanners.length === 0 && (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                          Сканеры не найдены
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* File Upload and Actions */}
          <Grid size={{ xs: 12, md: batchMode ? 12 : 5 }}>
            <Stack spacing={2}>
              {/* Selected Scanner Info (single mode only) */}
              {!batchMode && selectedScanner && (
                <Card elevation={0} sx={{ border: "1px solid", borderColor: "primary.main", bgcolor: "action.selected" }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={600}>
                            {selectedScanner.name}
                          </Typography>
                          <Chip
                            label={selectedScanner.category}
                            size="small"
                            sx={{
                              height: 20,
                              bgcolor: getCategoryColor(selectedScanner.category),
                              color: "white",
                              fontSize: "0.7rem",
                            }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Форматы: {selectedScanner.formats.join(", ").toUpperCase()}
                        </Typography>
                      </Box>
                      {selectedScanner.docsUrl && (
                        <Tooltip title="Документация">
                          <IconButton
                            size="small"
                            href={selectedScanner.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <InfoOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                    {/* Custom tool name for Generic SARIF */}
                    {selectedScanner.id === "sarif" && (
                      <Box sx={{ mt: 2 }}>
                        <TextField
                          label="Название инструмента (опционально)"
                          fullWidth
                          size="small"
                          placeholder="Например: my-custom-scanner"
                          value={customToolName}
                          onChange={(e) => setCustomToolName(e.target.value)}
                          disabled={loading}
                          helperText="Укажите название инструмента для фильтров. Если не указано, будет определено из SARIF файла."
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* File Upload */}
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {batchMode ? "1. Загрузите файлы отчётов" : "2. Загрузите файл отчёта"}
                  </Typography>
                  {batchMode ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Перетащите несколько файлов или ZIP-архив. Сканер будет определён автоматически.
                    </Typography>
                  ) : null}
                  <DragDropUpload
                    onFileSelect={setFile}
                    onFilesSelect={handleFilesSelect}
                    onScannerDetected={handleScannerDetected}
                    file={file}
                    files={files}
                    accept=".json,.sarif,.csv,.xml,.jsonl,.zip"
                    disabled={loading || batchUploading}
                    uploading={loading}
                    uploadProgress={uploadProgress}
                    uploadComplete={Boolean(success)}
                    multiple={batchMode}
                    showValidation={true}
                    enableClipboard={true}
                    enableArchives={true}
                  />
                </CardContent>
              </Card>

              {/* Batch results */}
              {batchMode && batchResults.length > 0 && (
                <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Результаты загрузки
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      <Chip
                        label={`Успешно: ${batchStats.successCount}`}
                        color="success"
                        size="small"
                      />
                      {batchStats.errorCount > 0 && (
                        <Chip
                          label={`Ошибок: ${batchStats.errorCount}`}
                          color="error"
                          size="small"
                        />
                      )}
                      <Chip
                        label={`Всего находок: ${batchStats.totalFindings}`}
                        color="primary"
                        size="small"
                      />
                    </Stack>
                    <Stack spacing={1}>
                      {batchResults.map((r, i) => (
                        <Paper
                          key={i}
                          sx={{
                            p: 1,
                            bgcolor:
                              r.status === "error"
                                ? "error.light"
                                : r.status === "success"
                                ? "success.light"
                                : "action.hover",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1} alignItems="center">
                              {r.status === "uploading" && (
                                <LinearProgress sx={{ width: 20 }} />
                              )}
                              {r.status === "success" && (
                                <CheckCircleIcon fontSize="small" color="success" />
                              )}
                              {r.status === "error" && (
                                <ErrorIcon fontSize="small" color="error" />
                              )}
                              <Typography variant="body2">{r.file.name}</Typography>
                            </Stack>
                            {r.result && (
                              <Chip
                                label={`${r.result.createdFindings} находок`}
                                size="small"
                                color="success"
                              />
                            )}
                            {r.error && (
                              <Typography variant="caption" color="error">
                                {r.error}
                              </Typography>
                            )}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Advanced Options */}
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ py: 1 }}>
                  <Button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    size="small"
                    sx={{ mb: showAdvanced ? 1 : 0 }}
                  >
                    Дополнительные настройки
                  </Button>
                  <Collapse in={showAdvanced}>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Укажите информацию о продукте для группировки находок
                      </Typography>
                      <TextField
                        label="Название продукта"
                        fullWidth
                        size="small"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        disabled={loading || batchUploading}
                      />
                      <Stack direction="row" spacing={2}>
                        <TextField
                          label="Версия"
                          fullWidth
                          size="small"
                          value={productVersion}
                          onChange={(e) => setProductVersion(e.target.value)}
                          disabled={loading || batchUploading}
                        />
                        <TextField
                          label="Идентификатор"
                          fullWidth
                          size="small"
                          value={productIdentifier}
                          onChange={(e) => setProductIdentifier(e.target.value)}
                          disabled={loading || batchUploading}
                        />
                      </Stack>
                    </Stack>
                  </Collapse>
                </CardContent>
              </Card>

              {/* Error */}
              {error && <Alert severity="error">{error}</Alert>}

              {/* Actions */}
              <Stack direction="row" spacing={2}>
                {batchMode ? (
                  batchResults.some((r) => r.status === "success") ? (
                    <Button variant="contained" onClick={handleReset} fullWidth>
                      Загрузить ещё
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleBatchUpload}
                      disabled={!isValid || batchUploading}
                      fullWidth
                    >
                      {batchUploading
                        ? `Загрузка... (${batchResults.filter((r) => r.status === "success").length}/${files.length})`
                        : `Загрузить ${files.length} файлов`}
                    </Button>
                  )
                ) : success ? (
                  <Button variant="contained" onClick={handleReset} fullWidth>
                    Загрузить ещё
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleUpload}
                    disabled={!isValid || loading}
                    fullWidth
                  >
                    {loading ? "Загрузка..." : "Загрузить"}
                  </Button>
                )}
              </Stack>

              {/* Success Results (single mode) */}
              {!batchMode && success && (
                <Card elevation={0} sx={{ border: "1px solid", borderColor: "success.main" }}>
                  <CardContent>
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
                            Детали
                          </Button>
                        </Stack>
                      }
                    >
                      <Typography variant="body2">
                        Создано: <strong>{success.createdFindings}</strong>
                        {success.duplicates > 0 && (
                          <>, дубликатов: <strong>{success.duplicates}</strong></>
                        )}
                      </Typography>
                    </Alert>

                    {/* Preview */}
                    <Typography variant="subtitle2" gutterBottom>
                      Предпросмотр ({previewTotal ?? 0})
                    </Typography>
                    {previewLoading && <LinearProgress sx={{ mb: 1 }} />}
                    {previewError && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        {previewError}
                      </Alert>
                    )}
                    {previewTotal === 0 && !previewLoading && (
                      <Alert severity="info">Уязвимостей не найдено</Alert>
                    )}
                    {previewFindings.length > 0 && (
                      <Stack spacing={1}>
                        {previewFindings.slice(0, 5).map((finding) => {
                          const semgrepEvidence = getSemgrepEvidence(finding.evidence);
                          const path = semgrepEvidence?.path || "";
                          const startLine = semgrepEvidence?.start?.line;
                          return (
                            <Paper
                              key={finding.id}
                              sx={{
                                p: 1,
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
                              </Stack>
                            </Paper>
                          );
                        })}
                        {(previewTotal ?? 0) > 5 && (
                          <Button size="small" onClick={handleViewFindings}>
                            Показать все {previewTotal}
                          </Button>
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
};

export default ScanUploadPage;
