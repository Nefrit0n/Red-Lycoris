import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAnalysisJob,
  SCANNER_PRESETS,
} from "../../../api/analysisJobs";
import { ApiError } from "../../../api/client";
import {
  createSourceSnapshot,
  fetchLatestSourceSnapshot,
  listSourceSnapshots,
  type SourceSnapshot,
} from "../../../api/sourceSnapshots";
import { useNotification } from "../../../contexts/NotificationContext";
import ProductSection from "./ProductSection";
import SourceSection, { type SourceMode } from "./SourceSection";
import ScannerSection from "./ScannerSection";

const DRAWER_WIDTH = 560;
const MAX_ARCHIVE_MB = 200;
const SNAPSHOTS_PAGE_SIZE = 50;

interface RunBuilderDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const RunBuilderDrawer = ({ open, onClose, onCreated }: RunBuilderDrawerProps) => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  // Product
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductLabel, setSelectedProductLabel] = useState("");

  // Source
  const [sourceMode, setSourceMode] = useState<SourceMode>("latest");
  const [archive, setArchive] = useState<File | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<SourceSnapshot | null>(null);
  const [latestSnapshotLoading, setLatestSnapshotLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<SourceSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");

  // Scanners
  const [selectedScanners, setSelectedScanners] = useState<string[]>([
    ...SCANNER_PRESETS.fast.scanners,
  ]);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load snapshots when product changes
  useEffect(() => {
    if (!selectedProductId || !open) {
      setLatestSnapshot(null);
      setSnapshots([]);
      setSelectedSnapshotId("");
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setLatestSnapshotLoading(true);
      setSnapshotsLoading(true);
      try {
        const [latestResult, listResult] = await Promise.allSettled([
          fetchLatestSourceSnapshot(selectedProductId),
          listSourceSnapshots(selectedProductId, SNAPSHOTS_PAGE_SIZE, 0),
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

    load();
    return () => controller.abort();
  }, [selectedProductId, open, sourceMode]);

  // Sync snapshot selection with source mode
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

  // Validation
  const canSubmit = useMemo(() => {
    if (!selectedProductId) return false;
    if (sourceMode === "latest" && !latestSnapshot) return false;
    if (sourceMode === "select" && !selectedSnapshotId) return false;
    if ((sourceMode === "upload" || sourceMode === "ephemeral") && !archive) return false;
    if (selectedScanners.length === 0) return false;
    return true;
  }, [selectedProductId, sourceMode, latestSnapshot, selectedSnapshotId, archive, selectedScanners]);

  // Summaries
  const productSummary = useMemo(() => {
    if (!selectedProductId) return "Не выбран";
    return selectedProductLabel || selectedProductId;
  }, [selectedProductId, selectedProductLabel]);

  const sourceSummary = useMemo(() => {
    switch (sourceMode) {
      case "latest":
        return latestSnapshot
          ? `Последний снапшот · ${new Date(latestSnapshot.createdAt).toLocaleDateString("ru-RU")}`
          : "Последний снапшот";
      case "select": {
        const snap = snapshots.find((s) => s.id === selectedSnapshotId);
        return snap?.label || snap?.originalFilename || "Выбранный снапшот";
      }
      case "upload":
        return archive ? `Новый · ${archive.name}` : "Новый снапшот";
      case "ephemeral":
      default:
        return archive ? `Архив · ${archive.name}` : "Архив задачи";
    }
  }, [archive, latestSnapshot, selectedSnapshotId, snapshots, sourceMode]);

  const scannerSummary = useMemo(() => {
    if (selectedScanners.length === 0) return "Не выбраны";
    return selectedScanners.length <= 3
      ? selectedScanners.join(", ")
      : `${selectedScanners.length} сканеров`;
  }, [selectedScanners]);

  const scannerWarnings = useMemo(() => {
    if (selectedScanners.length === 0) return ["Нужно выбрать хотя бы один сканер."];
    return [];
  }, [selectedScanners.length]);

  // Reset form
  const resetForm = useCallback(() => {
    setSelectedProductId("");
    setSelectedProductLabel("");
    setSourceMode("latest");
    setArchive(null);
    setLatestSnapshot(null);
    setSnapshots([]);
    setSelectedSnapshotId("");
    setSelectedScanners([...SCANNER_PRESETS.fast.scanners]);
    setSubmitting(false);
    setUploadProgress(null);
    setSubmitError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const handleSubmit = useCallback(async () => {
    if (submitting || !canSubmit) return;

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
        const snapshotKey = crypto.randomUUID();
        setUploadProgress(0);
        const snapshot = await createSourceSnapshot(selectedProductId, archive, {
          idempotencyKey: snapshotKey,
          onProgress: setUploadProgress,
        });
        sourceSnapshotId = snapshot.id;
      } else if (sourceMode === "ephemeral" && archive) {
        archiveToUpload = archive;
      }

      const jobKey = crypto.randomUUID();
      if (archiveToUpload) setUploadProgress(0);

      const response = await createAnalysisJob({
        productId: selectedProductId,
        scanners: selectedScanners,
        archive: archiveToUpload,
        sourceSnapshotId,
        sourceMode: sourceMode === "latest" ? "latest" : undefined,
        idempotencyKey: jobKey,
        onProgress: archiveToUpload ? setUploadProgress : undefined,
      });

      showSuccess("Анализ поставлен в очередь.");
      onCreated?.();
      resetForm();
      onClose();
      navigate(`/runs/${response.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 413) {
          showError(`Архив слишком большой. Максимум: ${MAX_ARCHIVE_MB} MB.`);
          return;
        }
        if (err.code === "PASSWORD_CHANGE_REQUIRED") return;
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
    canSubmit,
    latestSnapshot,
    navigate,
    onClose,
    onCreated,
    resetForm,
    selectedProductId,
    selectedScanners,
    selectedSnapshotId,
    showError,
    showSuccess,
    sourceMode,
    submitting,
  ]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: DRAWER_WIDTH },
          maxWidth: "100vw",
        },
      }}
    >
      <Stack sx={{ height: "100%", overflow: "hidden" }}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Typography variant="h6">Новый анализ</Typography>
          <IconButton onClick={handleClose} size="small" disabled={submitting}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* Scrollable content */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
          <Stack spacing={3}>
            {/* Section 1: Product */}
            <ProductSection
              selectedProductId={selectedProductId}
              onProductIdChange={setSelectedProductId}
              onProductLabelChange={setSelectedProductLabel}
            />

            <Divider />

            {/* Section 2: Source */}
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

            <Divider />

            {/* Section 3: Scanners */}
            <ScannerSection
              selectedScanners={selectedScanners}
              onScannersChange={setSelectedScanners}
              warnings={scannerWarnings}
            />
          </Stack>
        </Box>

        {/* Footer: Summary + CTA */}
        <Box
          sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            px: 3,
            py: 2,
            bgcolor: "background.paper",
          }}
        >
          <Stack spacing={1.5}>
            {/* Compact summary */}
            <Box
              sx={{
                bgcolor: "action.hover",
                borderRadius: 1.5,
                px: 2,
                py: 1.5,
              }}
            >
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">
                  Продукт: <Typography component="span" variant="caption" color="text.primary">{productSummary}</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Источник: <Typography component="span" variant="caption" color="text.primary">{sourceSummary}</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Сканеры: <Typography component="span" variant="caption" color="text.primary">{scannerSummary}</Typography>
                </Typography>
              </Stack>
            </Box>

            {/* Upload progress */}
            <Box sx={{ minHeight: 24 }}>
              {uploadProgress !== null && (
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Загрузка: {uploadProgress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Stack>
              )}
              {submitError && (
                <Typography variant="caption" color="error">
                  {submitError}
                </Typography>
              )}
            </Box>

            {/* CTA */}
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {submitting ? "Запуск..." : "Запустить анализ"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  );
};

export default RunBuilderDrawer;
