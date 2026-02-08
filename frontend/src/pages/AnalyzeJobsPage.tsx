import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  AnalysisJob,
  createAnalysisJob,
  fetchAnalysisJobs,
} from "../api/analysisJobs";
import { ApiError } from "../api/client";
import { createProduct } from "../api/products";
import {
  createProductSourceSnapshot,
  fetchLatestProductSourceSnapshot,
  ProductSourceSnapshot,
} from "../api/productSourceSnapshots";
import { ArchiveDropzone } from "../components/ArchiveDropzone";
import PaginationControl from "../components/PaginationControl";
import { ProductAutocomplete } from "../components/ProductAutocomplete";
import { useNotification } from "../contexts/NotificationContext";

type ProductMode = "existing" | "new";

type SourceMode = "latest" | "snapshot" | "job";

const AnalyzeJobsPage = () => {
  const { showError, showSuccess } = useNotification();
  const maxArchiveMb = 200;

  const [productMode, setProductMode] = useState<ProductMode>("existing");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProductLabel, setSelectedProductLabel] = useState<string>("");
  const [newProductName, setNewProductName] = useState<string>("");
  const [newProductVersion, setNewProductVersion] = useState<string>("");
  const [newProductIdentifier, setNewProductIdentifier] = useState<string>("");

  const [sourceMode, setSourceMode] = useState<SourceMode>("job");
  const [archive, setArchive] = useState<File | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<ProductSourceSnapshot | null>(null);
  const [latestSnapshotLoading, setLatestSnapshotLoading] = useState(false);

  const [runSemgrep, setRunSemgrep] = useState(true);
  const [runTrivy, setRunTrivy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<{ message: string; canRetry: boolean } | null>(
    null
  );

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

  const productSummary = useMemo(() => {
    if (productMode === "new") {
      if (!newProductName) return "Новый продукт";
      return `${newProductName}${newProductVersion ? ` · ${newProductVersion}` : ""}`;
    }
    return selectedProductLabel || selectedProductId || "Продукт не выбран";
  }, [productMode, newProductName, newProductVersion, selectedProductLabel, selectedProductId]);

  const sourceSummary = useMemo(() => {
    switch (sourceMode) {
      case "latest":
        return latestSnapshot
          ? `Последний снапшот · ${new Date(latestSnapshot.createdAt).toLocaleDateString("ru-RU")}`
          : "Последний снапшот";
      case "snapshot":
        return archive ? `Новый снапшот · ${archive.name}` : "Новый снапшот";
      case "job":
      default:
        return archive ? `Архив для задачи · ${archive.name}` : "Архив для задачи";
    }
  }, [sourceMode, latestSnapshot, archive]);

  const scannerSummary = useMemo(() => {
    if (scanners.length === 0) return "Сканеры не выбраны";
    return scanners.join(" + ");
  }, [scanners]);

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
    const controller = new AbortController();
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs]);

  useEffect(() => {
    if (productMode === "new") {
      setSelectedProductId("");
      setSelectedProductLabel("");
    }
  }, [productMode]);

  useEffect(() => {
    if (productMode === "new") {
      setLatestSnapshot(null);
      setSourceMode("snapshot");
      return;
    }
    if (!selectedProductId) {
      setLatestSnapshot(null);
      setSourceMode("job");
      return;
    }

    const controller = new AbortController();
    const loadLatest = async () => {
      setLatestSnapshotLoading(true);
      try {
        const snapshot = await fetchLatestProductSourceSnapshot(selectedProductId);
        setLatestSnapshot(snapshot);
        setSourceMode("latest");
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setLatestSnapshot(null);
          setSourceMode("snapshot");
        }
      } finally {
        setLatestSnapshotLoading(false);
      }
    };

    loadLatest();
    return () => controller.abort();
  }, [productMode, selectedProductId]);

  useEffect(() => {
    if (sourceMode === "latest") {
      setArchive(null);
    }
  }, [sourceMode]);

  const handlePreset = (preset: "fast" | "full") => {
    if (preset === "fast") {
      setRunSemgrep(true);
      setRunTrivy(false);
    } else {
      setRunSemgrep(true);
      setRunTrivy(true);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (scanners.length === 0) {
      showError("Выберите хотя бы один сканер.");
      return;
    }

    if (productMode === "existing" && !selectedProductId) {
      showError("Выберите существующий продукт.");
      return;
    }

    if (productMode === "new" && !newProductName.trim()) {
      showError("Введите название нового продукта.");
      return;
    }

    if (sourceMode === "latest" && !latestSnapshot) {
      showError("Для этого продукта нет сохранённых снапшотов.");
      return;
    }

    if (sourceMode !== "latest" && !archive) {
      showError("Добавьте архив исходников.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);
    setSubmitError(null);

    try {
      let productId = selectedProductId;

      if (productMode === "new") {
        const created = await createProduct({
          name: newProductName.trim(),
          version: newProductVersion.trim() || undefined,
          identifier: newProductIdentifier.trim() || undefined,
        });
        productId = created.id;
        setSelectedProductId(created.id);
        setSelectedProductLabel(created.name);
      }

      let sourceSnapshotId: string | undefined;
      let archiveToUpload: File | undefined;

      if (sourceMode === "latest") {
        sourceSnapshotId = latestSnapshot?.id;
      } else if (sourceMode === "snapshot" && archive) {
        const snapshotIdempotencyKey = crypto.randomUUID();
        setUploadProgress(0);
        const snapshot = await createProductSourceSnapshot(productId, archive, {
          idempotencyKey: snapshotIdempotencyKey,
          onProgress: setUploadProgress,
        });
        sourceSnapshotId = snapshot.id;
      } else if (sourceMode === "job" && archive) {
        archiveToUpload = archive;
      }

      if (!productId) {
        showError("Не удалось определить продукт для запуска анализа.");
        return;
      }

      const jobIdempotencyKey = crypto.randomUUID();
      if (archiveToUpload) {
        setUploadProgress(0);
      }

      await createAnalysisJob({
        productId,
        scanners,
        archive: archiveToUpload,
        sourceSnapshotId,
        idempotencyKey: jobIdempotencyKey,
        onProgress: archiveToUpload ? setUploadProgress : undefined,
      });

      showSuccess("Анализ поставлен в очередь.");
      setArchive(null);
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 413) {
          showError(`Архив слишком большой. Максимум: ${maxArchiveMb} MB.`);
          return;
        }
        if (err.status === 401 || err.status === 403) {
          showError("Сессия/tenant context недоступны, перелогиньтесь.");
          return;
        }
        if (err.status >= 500) {
          const message = err.message || "Ошибка сервера. Попробуйте еще раз.";
          setSubmitError({ message, canRetry: true });
          showError(message);
          return;
        }
        showError(err.message || "Не удалось создать анализ");
        return;
      }
      const message = err instanceof Error ? err.message : "Не удалось создать анализ";
      showError(message);
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  };

  const statusChip = (status: string) => {
    switch (status) {
      case "queued":
        return <Chip label="В очереди" size="small" />;
      case "processing":
        return <Chip label="В работе" size="small" color="info" />;
      case "succeeded":
        return <Chip label="Успешно" size="small" color="success" />;
      case "failed":
        return <Chip label="Ошибка" size="small" color="error" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const formatStats = (job: AnalysisJob) => {
    const repeats = Math.max(job.findingsTotal - job.findingsNew - job.duplicatesTotal, 0);
    return `Новые: ${job.findingsNew} · Повторы: ${repeats} · Дубликаты: ${job.duplicatesTotal}`;
  };

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Анализ
          </Typography>
          <Typography color="text.secondary">
            Настройте продукт, исходники и сканеры, чтобы запустить анализ.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start">
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={2}>
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle1">Шаг 1. Продукт</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {productSummary}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <Tabs
                        value={productMode}
                        onChange={(_, value) => setProductMode(value)}
                        variant="fullWidth"
                      >
                        <Tab value="existing" label="Существующий" />
                        <Tab value="new" label="Новый" />
                      </Tabs>

                      {productMode === "existing" ? (
                        <ProductAutocomplete
                          value={selectedProductId}
                          returnId
                          onChange={(value) => setSelectedProductId(value)}
                          onLabelChange={setSelectedProductLabel}
                        />
                      ) : (
                        <Stack spacing={2}>
                          <Typography color="text.secondary" variant="body2">
                            Создайте продукт перед запуском анализа. Поля версии и identifier опциональны.
                          </Typography>
                          <TextField
                            label="Название продукта *"
                            value={newProductName}
                            onChange={(event) => setNewProductName(event.target.value)}
                            placeholder="Lotus Platform"
                            fullWidth
                          />
                          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                            <TextField
                              label="Версия"
                              value={newProductVersion}
                              onChange={(event) => setNewProductVersion(event.target.value)}
                              placeholder="v1.0.0"
                              fullWidth
                            />
                            <TextField
                              label="Identifier"
                              value={newProductIdentifier}
                              onChange={(event) => setNewProductIdentifier(event.target.value)}
                              placeholder="lotus-platform"
                              fullWidth
                            />
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle1">Шаг 2. Исходники</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {sourceSummary}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <FormControl>
                        <FormLabel>Источник архива</FormLabel>
                        <RadioGroup
                          value={sourceMode}
                          onChange={(event) => setSourceMode(event.target.value as SourceMode)}
                        >
                          <FormControlLabel
                            value="latest"
                            control={<Radio />}
                            disabled={productMode === "new" || (!latestSnapshot && !latestSnapshotLoading)}
                            label="Использовать последний загруженный архив"
                          />
                          <FormControlLabel
                            value="snapshot"
                            control={<Radio />}
                            label="Загрузить и сохранить новый архив для продукта"
                          />
                          <FormControlLabel
                            value="job"
                            control={<Radio />}
                            label="Загрузить архив только для этой задачи"
                          />
                        </RadioGroup>
                      </FormControl>

                      {latestSnapshotLoading && (
                        <Typography variant="body2" color="text.secondary">
                          Проверяем наличие снапшота...
                        </Typography>
                      )}

                      {sourceMode !== "latest" && (
                        <ArchiveDropzone
                          value={archive}
                          onChange={setArchive}
                          helperText="Поддерживаются .zip, .tar.gz, .tgz"
                        />
                      )}

                      {sourceMode === "latest" && latestSnapshot && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="subtitle2">Последний снапшот</Typography>
                          <Typography color="text.secondary" variant="body2">
                            Создан: {new Date(latestSnapshot.createdAt).toLocaleString("ru-RU")}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            Размер: {Math.round(latestSnapshot.size / 1024)} KB
                          </Typography>
                        </Paper>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle1">Шаг 3. Сканеры</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {scannerSummary}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <Card variant="outlined" sx={{ flex: 1 }}>
                          <CardContent>
                            <Stack spacing={1}>
                              <Typography variant="subtitle1">Semgrep</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Поиск уязвимостей в коде и конфигурации.
                              </Typography>
                              <Button
                                variant={runSemgrep ? "contained" : "outlined"}
                                onClick={() => setRunSemgrep((prev) => !prev)}
                              >
                                {runSemgrep ? "Включен" : "Выключен"}
                              </Button>
                            </Stack>
                          </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ flex: 1 }}>
                          <CardContent>
                            <Stack spacing={1}>
                              <Typography variant="subtitle1">Trivy</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Анализ контейнеров и зависимостей.
                              </Typography>
                              <Button
                                variant={runTrivy ? "contained" : "outlined"}
                                onClick={() => setRunTrivy((prev) => !prev)}
                              >
                                {runTrivy ? "Включен" : "Выключен"}
                              </Button>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Stack>

                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <Button variant="outlined" onClick={() => handlePreset("fast")}>
                          Быстро (Semgrep)
                        </Button>
                        <Button variant="outlined" onClick={() => handlePreset("full")}>
                          Полный (Semgrep + Trivy)
                        </Button>
                      </Stack>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Stack>
            </CardContent>
          </Card>

          <Card
            sx={{
              width: { xs: "100%", lg: 320 },
              position: { lg: "sticky" },
              top: { lg: 24 },
            }}
          >
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Итоговая сводка</Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Продукт: {productSummary}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Источник: {sourceSummary}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Сканеры: {scannerSummary}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Максимальный архив: {maxArchiveMb} MB
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    Запустить анализ
                  </Button>
                  <Box sx={{ width: 24, display: "flex", justifyContent: "center" }}>
                    {submitting && <CircularProgress size={18} />}
                  </Box>
                </Stack>

                {uploadProgress !== null && (
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Загрузка архива: {uploadProgress}%
                    </Typography>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                  </Stack>
                )}

                {submitError && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "error.main" }}>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="error">
                        {submitError.message}
                      </Typography>
                      {submitError.canRetry && (
                        <Button variant="outlined" color="error" onClick={handleSubmit}>
                          Повторить
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : (
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
              <Box component="thead" sx={{ backgroundColor: "action.hover" }}>
                <Box component="tr">
                  {["ID анализа", "Продукт", "Сканеры", "Статус", "Статистика", "Создан"].map(
                    (label) => (
                      <Box
                        component="th"
                        key={label}
                        sx={{ textAlign: "left", px: 2, py: 1.5, fontWeight: 600, fontSize: 13 }}
                      >
                        {label}
                      </Box>
                    )
                  )}
                </Box>
              </Box>
              <Box component="tbody">
                {data.length === 0 ? (
                  <Box component="tr">
                    <Box component="td" colSpan={6} sx={{ py: 6, textAlign: "center" }}>
                      <Typography color="text.secondary">Анализов пока нет.</Typography>
                    </Box>
                  </Box>
                ) : (
                  data.map((item) => (
                    <Box component="tr" key={item.id} sx={{ borderTop: "1px solid", borderColor: "divider" }}>
                      <Box component="td" sx={{ px: 2, py: 1.5 }}>
                        <Button component={Link} to={`/analyze/${item.id}`} size="small">
                          {item.id}
                        </Button>
                      </Box>
                      <Box component="td" sx={{ px: 2, py: 1.5 }}>
                        {item.productName || "—"}
                      </Box>
                      <Box component="td" sx={{ px: 2, py: 1.5 }}>
                        {item.scanners.join(", ")}
                      </Box>
                      <Box component="td" sx={{ px: 2, py: 1.5 }}>
                        {statusChip(item.status)}
                      </Box>
                      <Box component="td" sx={{ px: 2, py: 1.5 }}>
                        {formatStats(item)}
                      </Box>
                      <Box component="td" sx={{ px: 2, py: 1.5 }}>
                        {new Date(item.createdAt).toLocaleString("ru-RU")}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          )}
        </Paper>

        {error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
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
    </Box>
  );
};

export default AnalyzeJobsPage;
