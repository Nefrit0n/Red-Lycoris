import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnalysisJob,
  createAnalysisJob,
  fetchAnalysisJobs,
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

const AnalyzeJobsPage = () => {
  const { showError, showSuccess } = useNotification();
  const historyRef = useRef<HTMLDivElement | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductLabel, setSelectedProductLabel] = useState("");

  const [sourceMode, setSourceMode] = useState<SourceMode>("latest");
  const [archive, setArchive] = useState<File | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<SourceSnapshot | null>(null);
  const [latestSnapshotLoading, setLatestSnapshotLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<SourceSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");

  const [runSemgrep, setRunSemgrep] = useState(true);
  const [runTrivy, setRunTrivy] = useState(true);

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

  const scanners = useMemo(() => {
    const list: string[] = [];
    if (runSemgrep) list.push("semgrep");
    if (runTrivy) list.push("trivy");
    return list;
  }, [runSemgrep, runTrivy]);

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

  const handlePreset = useCallback((preset: "fast" | "full") => {
    if (preset === "fast") {
      setRunSemgrep(true);
      setRunTrivy(false);
    } else {
      setRunSemgrep(true);
      setRunTrivy(true);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (scanners.length === 0) {
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
        scanners,
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
    scanners,
    selectedProductId,
    selectedSnapshotId,
    showError,
    showSuccess,
    sourceMode,
    submitting,
  ]);

  const scannerWarnings = useMemo(() => {
    if (scanners.length === 0) {
      return ["Нужно выбрать хотя бы один сканер."];
    }
    return [];
  }, [scanners.length]);

  const handleHistoryClick = useCallback(() => {
    historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <Box px={{ xs: 2, md: 4 }} py={{ xs: 3, md: 4 }} sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={3}>
        <AnalyzeHeader onHistoryClick={handleHistoryClick} />

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start">
          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={2}>
                <ProductSection
                  selectedProductId={selectedProductId}
                  onProductIdChange={setSelectedProductId}
                  onProductLabelChange={setSelectedProductLabel}
                />

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

                <ScannerSection
                  runSemgrep={runSemgrep}
                  runTrivy={runTrivy}
                  onToggleSemgrep={() => setRunSemgrep((prev) => !prev)}
                  onToggleTrivy={() => setRunTrivy((prev) => !prev)}
                  onPreset={handlePreset}
                  warnings={scannerWarnings}
                />
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
