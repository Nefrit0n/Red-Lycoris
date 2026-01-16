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
import { useMemo, useState } from "react";
import { uploadScan, UploadScanResponse } from "../api/scans";

interface UploadHistoryItem extends UploadScanResponse {
  fileName: string;
  scannerType: string;
  uploadedAt: string;
}

const HISTORY_KEY = "lotus_warden_upload_history";

const ScanUploadPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [scannerType, setScannerType] = useState<string>("");
  const [productName, setProductName] = useState<string>("");
  const [productVersion, setProductVersion] = useState<string>("");
  const [productIdentifier, setProductIdentifier] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
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
                <Alert severity="success">
                  Загружено: создано находок {success.createdFindings}, дубликатов{" "}
                  {success.duplicates}.
                </Alert>
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
