import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFindingDetail, fetchFindings } from "../api/findings";
import { uploadScan, UploadScanResponse } from "../api/scans";
import { Finding, SemgrepEvidence } from "../types/findings";

interface UploadHistoryItem extends UploadScanResponse {
  fileName: string;
  scannerType: string;
  uploadedAt: string;
}

const HISTORY_KEY = "lotus_warden_upload_history";
const LAST_UPLOAD_KEY = "lotus_warden_last_upload";

interface FindingPreview extends Finding {
  evidence?: SemgrepEvidence | null;
}

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
  const [previewFindings, setPreviewFindings] = useState<FindingPreview[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [history, setHistory] = useState<UploadHistoryItem[]>(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw) as UploadHistoryItem[];
    } catch {
      return [];
    }
  });

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
    try {
      const result = await uploadScan({
        file,
        scannerType,
        productName: productName || undefined,
        productVersion: productVersion || undefined,
        productIdentifier: productIdentifier || undefined,
      });
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
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!success?.importJobId) {
      return;
    }

    const controller = new AbortController();
    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const response = await fetchFindings(
          {
            limit: 20,
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

  const handleViewFindings = () => {
    const params = new URLSearchParams();
    if (success?.productId) {
      params.set("productId", success.productId);
    }
    const search = params.toString();
    navigate({
      pathname: "/findings",
      search: search ? `?${search}` : "",
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
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Upload Scan
          </Typography>
          <Typography color="text.secondary">
            Загрузите отчёт сканера, чтобы создать результаты и находки.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="scanner-type-label">Scanner</InputLabel>
                <Select
                  labelId="scanner-type-label"
                  value={scannerType}
                  label="Scanner"
                  onChange={(event) => setScannerType(event.target.value)}
                >
                  <MenuItem value="trivy">Trivy</MenuItem>
                  <MenuItem value="zap">OWASP ZAP</MenuItem>
                  <MenuItem value="semgrep">Semgrep</MenuItem>
                </Select>
              </FormControl>

              <Button variant="outlined" component="label">
                {file ? `Файл: ${file.name}` : "Выбрать файл отчёта"}
                <input
                  hidden
                  type="file"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    setFile(selected);
                  }}
                />
              </Button>

              <Divider />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Product name"
                  fullWidth
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                />
                <TextField
                  label="Product version"
                  fullWidth
                  value={productVersion}
                  onChange={(event) => setProductVersion(event.target.value)}
                />
              </Stack>

              <TextField
                label="Product identifier"
                fullWidth
                value={productIdentifier}
                onChange={(event) => setProductIdentifier(event.target.value)}
              />

              {loading && <LinearProgress />}

              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!isValid || loading}
              >
                Upload
              </Button>

              {error && <Alert severity="error">{error}</Alert>}
              {success && (
                <Stack spacing={2}>
                  <Alert
                    severity="success"
                    action={
                      <Stack direction="row" spacing={1}>
                        <Button color="inherit" size="small" onClick={handleViewFindings}>
                          Перейти к находкам
                        </Button>
                        <Button color="inherit" size="small" onClick={handleViewImport}>
                          Импорт
                        </Button>
                      </Stack>
                    }
                  >
                    Загружено: создано находок {success.createdFindings}, дубликатов{" "}
                    {success.duplicates}.
                  </Alert>

                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Первые 20 находок
                    </Typography>
                    {previewLoading && <LinearProgress />}
                    {previewError && <Alert severity="error">{previewError}</Alert>}
                    {previewTotal === 0 && !previewLoading && !previewError && (
                      <Alert severity="info">В отчёте не найдено уязвимостей.</Alert>
                    )}
                    {previewFindings.length > 0 && (
                      <Box sx={{ overflowX: "auto" }}>
                        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                          <Box component="thead">
                            <Box component="tr" sx={{ textAlign: "left" }}>
                              {["Title / RuleId", "Path:Line", "Severity", "Status", ""].map((h) => (
                                <Box
                                  key={h}
                                  component="th"
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 12,
                                    padding: "10px 8px",
                                    borderBottom: "1px solid rgba(0,0,0,0.08)",
                                  }}
                                >
                                  {h}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          <Box component="tbody">
                            {previewFindings.map((finding) => {
                              const ruleId = finding.evidence?.ruleId || finding.title;
                              const path = finding.evidence?.path || "";
                              const startLine = finding.evidence?.start?.line;
                              const pathLine = path
                                ? `${path}${startLine ? `:${startLine}` : ""}`
                                : "—";
                              const occurrence = finding.occurrenceStatus === "REPEAT" ? "Repeat" : "New";
                              return (
                                <Box key={finding.id} component="tr">
                                  <Box
                                    component="td"
                                    style={{
                                      padding: "10px 8px",
                                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                                      fontSize: 13,
                                    }}
                                  >
                                    <Typography variant="body2">{finding.title}</Typography>
                                    {ruleId && ruleId !== finding.title && (
                                      <Typography variant="caption" color="text.secondary">
                                        {ruleId}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box
                                    component="td"
                                    style={{
                                      padding: "10px 8px",
                                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                                      fontSize: 13,
                                    }}
                                  >
                                    {pathLine}
                                  </Box>
                                  <Box
                                    component="td"
                                    style={{
                                      padding: "10px 8px",
                                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                                      fontSize: 13,
                                    }}
                                  >
                                    {finding.severity}
                                  </Box>
                                  <Box
                                    component="td"
                                    style={{
                                      padding: "10px 8px",
                                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                                      fontSize: 13,
                                    }}
                                  >
                                    {occurrence}
                                  </Box>
                                  <Box
                                    component="td"
                                    style={{
                                      padding: "10px 8px",
                                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                                      fontSize: 13,
                                      textAlign: "right",
                                    }}
                                  >
                                    <Button size="small" onClick={() => handleOpenFinding(finding.id)}>
                                      Открыть в находках
                                    </Button>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              История загрузок
            </Typography>
            <Stack spacing={1}>
              {history.length === 0 && (
                <Typography color="text.secondary">
                  Пока нет загруженных отчётов.
                </Typography>
              )}
              {history.map((entry) => (
                <Box key={`${entry.scanId}-${entry.uploadedAt}`}>
                  <Typography variant="subtitle2">{entry.fileName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.scannerType} ·{" "}
                    {new Date(entry.uploadedAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    Findings: {entry.createdFindings} · Duplicates:{" "}
                    {entry.duplicates}
                  </Typography>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default ScanUploadPage;
