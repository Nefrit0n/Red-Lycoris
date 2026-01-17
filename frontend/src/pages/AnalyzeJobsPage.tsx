import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Link as MuiLink,
  Paper,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnalysisJob,
  createAnalysisJob,
  fetchAnalysisJobs,
} from "../api/analysisJobs";
import { fetchProducts } from "../api/products";
import PaginationControl from "../components/PaginationControl";
import { Product } from "../types/products";

const AnalyzeJobsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [engagementId, setEngagementId] = useState<string>("");
  const [archive, setArchive] = useState<File | null>(null);
  const [runSemgrep, setRunSemgrep] = useState(true);
  const [runTrivy, setRunTrivy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [data, setData] = useState<AnalysisJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const scanners = useMemo(() => {
    const list: string[] = [];
    if (runSemgrep) list.push("semgrep");
    if (runTrivy) list.push("trivy");
    return list;
  }, [runSemgrep, runTrivy]);

  const isValid = Boolean(selectedProductId && archive && scanners.length > 0);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetchProducts(200, 0);
      setProducts(response.data);
    } catch {
      setProducts([]);
    }
  }, []);

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
          setError("Не удалось загрузить список анализов.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const controller = new AbortController();
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs]);

  const handleSubmit = async () => {
    if (!archive || !selectedProductId || scanners.length === 0) {
      setSubmitError("Заполните продукт, файл и список сканеров.");
      return;
    }
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);
    try {
      const response = await createAnalysisJob({
        productId: selectedProductId,
        engagementId: engagementId || undefined,
        scanners,
        archive,
      });
      setSubmitSuccess(`Анализ поставлен в очередь: ${response.id}`);
      setArchive(null);
      await loadJobs();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Не удалось создать анализ");
    } finally {
      setSubmitting(false);
    }
  };

  const formatStats = (job: AnalysisJob) => {
    const repeats = Math.max(job.findingsTotal - job.findingsNew - job.duplicatesTotal, 0);
    return `New: ${job.findingsNew} · Repeat: ${repeats} · Duplicates: ${job.duplicatesTotal}`;
  };

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Analyze
          </Typography>
          <Typography color="text.secondary">
            Запустите анализ кода проекта с помощью Semgrep и Trivy.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="product-label">Product</InputLabel>
                <Select
                  labelId="product-label"
                  label="Product"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                >
                  {products.length === 0 && (
                    <MenuItem value="">
                      <em>Нет доступных продуктов</em>
                    </MenuItem>
                  )}
                  {products.map((product) => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Engagement ID (optional)"
                value={engagementId}
                onChange={(event) => setEngagementId(event.target.value)}
                placeholder="UUID"
                fullWidth
              />

              <Button variant="outlined" component="label">
                {archive ? `Файл: ${archive.name}` : "Загрузить архив (zip/tar.gz)"}
                <input
                  hidden
                  type="file"
                  accept=".zip,.tar.gz,.tgz"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    setArchive(selected);
                  }}
                />
              </Button>

              <Divider />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={runSemgrep}
                      onChange={(event) => setRunSemgrep(event.target.checked)}
                    />
                  }
                  label="Semgrep"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={runTrivy}
                      onChange={(event) => setRunTrivy(event.target.checked)}
                    />
                  }
                  label="Trivy"
                />
              </Stack>

              {submitting && <CircularProgress size={24} />}

              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!isValid || submitting}
              >
                Запустить анализ
              </Button>

              {submitError && <Alert severity="error">{submitError}</Alert>}
              {submitSuccess && <Alert severity="success">{submitSuccess}</Alert>}
            </Stack>
          </CardContent>
        </Card>

        <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>Продукт</TableCell>
                  <TableCell>Сканеры</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Статистика</TableCell>
                  <TableCell>Создано</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">
                        Анализов пока нет.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <MuiLink component={Link} to={`/analyze/${item.id}`} underline="hover">
                          {item.id}
                        </MuiLink>
                      </TableCell>
                      <TableCell>{item.productName || "—"}</TableCell>
                      <TableCell>{item.scanners.join(", ")}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{formatStats(item)}</TableCell>
                      <TableCell>{new Date(item.createdAt).toLocaleString("ru-RU")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

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
    </Box>
  );
};

export default AnalyzeJobsPage;
