import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Step,
  StepLabel,
  Stepper,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnalysisJob,
  createAnalysisJob,
  fetchAnalysisJobs,
  SCANNER_PRESETS,
} from "../api/analysisJobs";
import { ApiError } from "../api/client";
import {
  createSourceSnapshot,
  fetchLatestSourceSnapshot,
  listSourceSnapshots,
  SourceSnapshot,
} from "../api/sourceSnapshots";
import PaginationControl from "../components/PaginationControl";
import { useNotification } from "../contexts/NotificationContext";
import AnalyzeHeader from "../features/analyze/components/AnalyzeHeader";
import ProductSection from "../features/analyze/components/ProductSection";
import RunSummary from "../features/analyze/components/RunSummary";
import ScannerSection from "../features/analyze/components/ScannerSection";
import RecentAnalyses from "../features/analyze/components/RecentAnalyses";
import SourceSection, { SourceMode } from "../features/analyze/components/SourceSection";

const maxArchiveMb = 200;
const snapshotsPageSize = 50;
const AUTO_REFRESH_INTERVAL = 10_000;

const STEPS = ["Продукт", "Источник", "Сканеры"];

const AnalyzeJobsPage = () => {
  const { showError, showSuccess } = useNotification();
  const historyRef = useRef<HTMLDivElement | null>(null);

  const [activeStep, setActiveStep] = useState(0);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductLabel, setSelectedProductLabel] = useState("");

  const [sourceMode, setSourceMode] = useState<SourceMode>("latest");
  const [archive, setArchive] = useState<File | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<SourceSnapshot | null>(null);
  const [latestSnapshotLoading, setLatestSnapshotLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<SourceSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");

  const [selectedScanners, setSelectedScanners] = useState<string[]>([
    ...SCANNER_PRESETS.fast.scanners,
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  const [data, setData] = useState<AnalysisJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const productSummary = useMemo(() => {
    if (!selectedProductId) return "Продукт не выбран";
    return selectedProductLabel || selectedProductId;
  }, [selectedProductId, selectedProductLabel]);

  const sourceSummary = useMemo(() => {
    switch (sourceMode) {
      case "latest":
        return latestSnapshot
          ? `Последний снапшот · ${new Date(latestSnapshot.createdAt).toLocaleDateString("ru-RU")}`
          : "Последний снапшот";
      case "select": {
        const snapshot = snapshots.find((item) => item.id === selectedSnapshotId);
        return snapshot?.label || snapshot?.originalFilename || "Выбранный снапшот";
      }
      case "upload":
        return archive ? `Новый снапшот · ${archive.name}` : "Новый снапшот";
      case "ephemeral":
      default:
        return archive ? `Архив задачи · ${archive.name}` : "Архив задачи";
    }
  }, [archive, latestSnapshot, selectedSnapshotId, snapshots, sourceMode]);

  const scannerSummary = useMemo(() => {
    if (selectedScanners.length === 0) return "Сканеры не выбраны";
    return selectedScanners.join(" + ");
  }, [selectedScanners]);

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

  // Auto-refresh when there are running jobs
  useEffect(() => {
    const hasRunning = data.some(
      (j) => j.status === "queued" || j.status === "processing"
    );
    if (!hasRunning) return;

    const interval = setInterval(() => {
      loadJobs();
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [data, loadJobs]);

  useEffect(() => {
    if (!selectedProductId) {
      setLatestSnapshot(null);
      setSnapshots([]);
      setSelectedSnapshotId("");
      return;
    }

    const controller = new AbortController();
    const loadSnapshots = async () => {
      setLatestSnapshotLoading(true);
      setSnapshotsLoading(true);
      try {
        const [latestResult, listResult] = await Promise.allSettled([
          fetchLatestSourceSnapshot(selectedProductId),
          listSourceSnapshots(selectedProductId, snapshotsPageSize, 0),
        ]);
        if (latestResult.status === "fulfilled") {
          setLatestSnapshot(latestResult.value);
          if (sourceMode === "latest") {
            setSelectedSnapshotId(latestResult.value?.id ?? "");
          }
        } else {
          setLatestSnapshot(null);
        }
        if (listResult.status === "fulfilled") {
          setSnapshots(listResult.value.data);
        } else {
          setSnapshots([]);
        }
      } catch {
        setLatestSnapshot(null);
        setSnapshots([]);
      } finally {
        setLatestSnapshotLoading(false);
        setSnapshotsLoading(false);
      }
    };

    loadSnapshots();
    return () => controller.abort();
  }, [selectedProductId, sourceMode]);

  useEffect(() => {
    if (sourceMode === "latest") {
      setArchive(null);
      if (latestSnapshot?.id) {
        setSelectedSnapshotId(latestSnapshot.id);
      }
    }
    if (sourceMode === "select") {
      setArchive(null);
    }
  }, [latestSnapshot, sourceMode]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (selectedScanners.length === 0) {
      showError("Выберите хотя бы один сканер.");
      return;
    }
    if (!selectedProductId) {
      showError("Выберите продукт.");
      return;
    }

    if (sourceMode === "latest" && !latestSnapshot) {
      showError("Для этого продукта нет сохранённых снапшотов.");
      return;
    }

    if (sourceMode === "select" && !selectedSnapshotId) {
      showError("Выберите снапшот из списка.");
      return;
    }

    if ((sourceMode === "upload" || sourceMode === "ephemeral") && !archive) {
      showError("Добавьте архив исходников.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);
    setSubmitError(null);

    try {
      let sourceSnapshotId: string | undefined;
      let archiveToUpload: File | undefined;

      if (sourceMode === "latest") {
        sourceSnapshotId = undefined;
      } else if (sourceMode === "select") {
        sourceSnapshotId = selectedSnapshotId;
      } else if (sourceMode === "upload" && archive) {
        const snapshotIdempotencyKey = crypto.randomUUID();
        setUploadProgress(0);
        const snapshot = await createSourceSnapshot(selectedProductId, archive, {
          idempotencyKey: snapshotIdempotencyKey,
          onProgress: setUploadProgress,
        });
        sourceSnapshotId = snapshot.id;
      } else if (sourceMode === "ephemeral" && archive) {
        archiveToUpload = archive;
      }

      const jobIdempotencyKey = crypto.randomUUID();
      if (archiveToUpload) {
        setUploadProgress(0);
      }

      const response = await createAnalysisJob({
        productId: selectedProductId,
        scanners: selectedScanners,
        archive: archiveToUpload,
        sourceSnapshotId,
        sourceMode: sourceMode === "latest" ? "latest" : undefined,
        idempotencyKey: jobIdempotencyKey,
        onProgress: archiveToUpload ? setUploadProgress : undefined,
      });

      showSuccess("Анализ поставлен в очередь.");
      setArchive(null);
      setLastJobId(response.id);
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 413) {
          showError(`Архив слишком большой. Максимум: ${maxArchiveMb} MB.`);
          return;
        }
        if (err.code === "PASSWORD_CHANGE_REQUIRED") {
          return;
        }
        const message = err.message || "Не удалось создать анализ";
        setSubmitError(message);
        showError(message);
        return;
      }
      const message = err instanceof Error ? err.message : "Не удалось создать анализ";
      setSubmitError(message);
      showError(message);
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  }, [
    archive,
    latestSnapshot,
    loadJobs,
    selectedScanners,
    selectedProductId,
    selectedSnapshotId,
    showError,
    showSuccess,
    sourceMode,
    submitting,
  ]);

  const scannerWarnings = useMemo(() => {
    if (selectedScanners.length === 0) {
      return ["Нужно выбрать хотя бы один сканер."];
    }
    return [];
  }, [selectedScanners.length]);

  const handleHistoryClick = useCallback(() => {
    historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const canProceed = useMemo(() => {
    switch (activeStep) {
      case 0:
        return Boolean(selectedProductId);
      case 1: {
        if (sourceMode === "latest") return Boolean(latestSnapshot);
        if (sourceMode === "select") return Boolean(selectedSnapshotId);
        if (sourceMode === "upload" || sourceMode === "ephemeral") return Boolean(archive);
        return false;
      }
      case 2:
        return selectedScanners.length > 0;
      default:
        return false;
    }
  }, [activeStep, selectedProductId, sourceMode, latestSnapshot, selectedSnapshotId, archive, selectedScanners]);

  const stepContent = useMemo(() => {
    switch (activeStep) {
      case 0:
        return (
          <ProductSection
            selectedProductId={selectedProductId}
            onProductIdChange={setSelectedProductId}
            onProductLabelChange={setSelectedProductLabel}
          />
        );
      case 1:
        return (
          <SourceSection
            sourceMode={sourceMode}
            onSourceModeChange={setSourceMode}
            hasProduct={Boolean(selectedProductId)}
            archive={archive}
            onArchiveChange={setArchive}
            latestSnapshot={latestSnapshot}
            latestSnapshotLoading={latestSnapshotLoading}
            snapshots={snapshots}
            snapshotsLoading={snapshotsLoading}
            selectedSnapshotId={selectedSnapshotId}
            onSnapshotChange={setSelectedSnapshotId}
            showSnapshotWarnings={!archive && (sourceMode === "upload" || sourceMode === "ephemeral")}
          />
        );
      case 2:
        return (
          <ScannerSection
            selectedScanners={selectedScanners}
            onScannersChange={setSelectedScanners}
            warnings={scannerWarnings}
          />
        );
      default:
        return null;
    }
  }, [
    activeStep,
    archive,
    latestSnapshot,
    latestSnapshotLoading,
    scannerWarnings,
    selectedProductId,
    selectedScanners,
    selectedSnapshotId,
    snapshots,
    snapshotsLoading,
    sourceMode,
  ]);

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={3}>
        <AnalyzeHeader onHistoryClick={handleHistoryClick} />

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start">
          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={3}>
                <Stepper activeStep={activeStep} alternativeLabel>
                  {STEPS.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>

                <Box sx={{ minHeight: 200 }}>
                  {stepContent}
                </Box>

                <Stack direction="row" justifyContent="space-between">
                  <Button
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep((prev) => prev - 1)}
                  >
                    Назад
                  </Button>
                  {activeStep < STEPS.length - 1 ? (
                    <Button
                      variant="contained"
                      disabled={!canProceed}
                      onClick={() => setActiveStep((prev) => prev + 1)}
                    >
                      Далее
                    </Button>
                  ) : (
                    <Box />
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <RunSummary
            productSummary={productSummary}
            sourceSummary={sourceSummary}
            scannerSummary={scannerSummary}
            submitting={submitting}
            uploadProgress={uploadProgress}
            lastJobId={lastJobId}
            onSubmit={handleSubmit}
            submitError={submitError}
            onRetry={submitError ? handleSubmit : undefined}
          />
        </Stack>

        <Box ref={historyRef}>
          <RecentAnalyses jobs={data} loading={loading} error={error} />
        </Box>

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
