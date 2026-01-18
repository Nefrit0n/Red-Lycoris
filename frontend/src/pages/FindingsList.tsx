import {
  Alert,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ViewCompactIcon from "@mui/icons-material/ViewCompact";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bulkUpdateFindings, fetchFindings } from "../api/findings";
import { getCurrentUser } from "../api/auth";
import BulkActionsBar from "../components/BulkActionsBar";
import FiltersPanel from "../components/FiltersPanel";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import { useUrlFiltersSync } from "../hooks/useUrlFiltersSync";
import { useFindingsData } from "../hooks/useFindingsData";
import { useBulkSelection } from "../hooks/useBulkSelection";
import { useDrawerState } from "../hooks/useDrawerState";
import { useUploadRedirect } from "../hooks/useUploadRedirect";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { Finding } from "../types/findings";

// 👇 важно: нужен экспорт FindingDetailContent из FindingDetail.tsx
import { FindingDetailContent } from "./FindingDetail";

const FindingsList = () => {
  const location = useLocation();
  const isMdUp = useMediaQuery("(min-width:900px)");

  // ✅ ВАЖНО: не даём эффекту "state -> URL" работать, пока не распарсили URL -> state
  const [hydrated, setHydrated] = useState(false);

  const [data, setData] = useState<Finding[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [productId, setProductId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const [importJobId, setImportJobId] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<FindingSeverity | "">("");
  const [filterStatus, setFilterStatus] = useState<FindingStatus | "">("");
  const [filterOccurrence, setFilterOccurrence] = useState<FindingOccurrenceStatus | "">("");
  const [filterScannerType, setFilterScannerType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRepeats, setShowRepeats] = useState(false);

  const [sortField, setSortField] = useState<keyof Finding>("lastSeenAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkUndoItems, setBulkUndoItems] = useState<BulkUndoItem[]>([]);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [undoToastOpen, setUndoToastOpen] = useState(false);

  // ✅ Drawer: выбранная находка
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Компактный режим таблицы
  const [compactMode, setCompactMode] = useState(false);

  // base returnTo без selected (чтобы если открыть в новой вкладке — назад не открывал Drawer снова)
  const listReturnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.delete("selected");
    const qs = params.toString();
    return `${location.pathname}${qs ? `?${qs}` : ""}`;
  }, [location.pathname, location.search]);

  const openDrawer = useCallback((id: string) => {
    const listPath = `${location.pathname}${location.search}`;
    sessionStorage.setItem(
      listStateKey,
      JSON.stringify({ path: listPath, scrollY: window.scrollY })
    );
    setSelectedFindingId(id);
  }, [location.pathname, location.search, listStateKey]);

  const closeDrawer = useCallback(() => {
    setSelectedFindingId(null);
  }, []);

  // 1) URL -> state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryProduct = params.get("product");
    const queryProductId = params.get("productId");
    const queryImportJobId = params.get("import_job_id");
    const querySeverity = params.get("severity");
    const queryStatus = params.get("status");
    const querySearch = params.get("search") ?? params.get("q") ?? "";
    const queryPage = Number(params.get("page") ?? "1");
    const queryLimit = Number(params.get("limit") ?? "20");
    const querySortField = params.get("sortField");
    const querySortOrder = params.get("sortOrder");
    const queryOccurrence = params.get("occurrenceStatus");
    const queryScanner = params.get("scannerType") ?? "";
    const queryDateFrom = params.get("dateFrom") ?? "";
    const queryDateTo = params.get("dateTo") ?? "";
    const queryIncludeRepeats = params.get("includeRepeats");
    const queryCanonicalOnly = params.get("canonicalOnly");

    // ✅ Drawer param
    const querySelected = params.get("selected");

    const nextPage =
      Number.isFinite(queryPage) && queryPage > 0 ? queryPage - 1 : 0;
    const nextPageSize =
      Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : 20;

    setPage((prev) => (prev !== nextPage ? nextPage : prev));
    setPageSize((prev) => (prev !== nextPageSize ? nextPageSize : prev));

    const nextProduct = queryProduct || queryProductId || "";
    setProductId((prev) => (prev !== nextProduct ? nextProduct : prev));

    const nextSeverity = severityOptions.includes(querySeverity as FindingSeverity)
      ? (querySeverity as FindingSeverity)
      : "";
    setFilterSeverity((prev) => (prev !== nextSeverity ? nextSeverity : prev));

  // Auto-redirect after upload
  useUploadRedirect(filters.pageSize);

  // Fetch findings data
  const { data, total, loading, error, fetchData, handleRetry } = useFindingsData({
    filters,
    hydrated,
  });

  // Debounced search for bulk actions
  const debouncedSearch = useDebouncedValue(filters.searchInput, 400);

  // Bulk selection and actions
  const bulk = useBulkSelection({
    data,
    total,
    filters,
    debouncedSearch,
    onSuccess: fetchData,
  });

  // Drawer state
  const drawer = useDrawerState({
    selectedFindingId: filters.selectedFindingId,
    setSelectedFindingId: actions.setSelectedFindingId,
    selectionCount: bulk.selectionCount,
  });

  // User permissions
  const user = getCurrentUser();
  const canBulk = user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  // Handle sort change
  const handleSortChange = useCallback(
    (field: keyof Finding) => {
      if (filters.sortField === field) {
        actions.setSortOrder(filters.sortOrder === "asc" ? "desc" : "asc");
      } else {
        actions.setSortField(field);
        actions.setSortOrder("asc");
      }
      actions.setPage(0);
    },
    [filters.sortField, filters.sortOrder, actions]
  );

  const drawerWidth = isMdUp ? 620 : "100vw";

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4" component="h1">
          Список находок
        </Typography>

        <Tooltip title="Переключить режим отображения">
          <ToggleButtonGroup
            value={compactMode ? "compact" : "normal"}
            exclusive
            onChange={(_, value) => {
              if (value !== null) setCompactMode(value === "compact");
            }}
            size="small"
            aria-label="Режим отображения"
          >
            <ToggleButton value="normal" aria-label="Нормальный режим">
              <ViewStreamIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="compact" aria-label="Компактный режим">
              <ViewCompactIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
      </Stack>

      <FiltersPanel
        productId={filters.productId}
        search={filters.searchInput}
        filterSeverity={filters.filterSeverity}
        filterStatus={filters.filterStatus}
        filterOccurrence={filters.filterOccurrence}
        filterScannerType={filters.filterScannerType}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        showRepeats={filters.showRepeats}
        onProductIdChange={actions.setProductId}
        onSearchChange={actions.setSearchInput}
        onSeverityChange={actions.setFilterSeverity}
        onStatusChange={actions.setFilterStatus}
        onOccurrenceChange={actions.setFilterOccurrence}
        onScannerTypeChange={actions.setFilterScannerType}
        onDateFromChange={actions.setDateFrom}
        onDateToChange={actions.setDateTo}
        onShowRepeatsChange={actions.setShowRepeats}
        onReset={actions.resetFilters}
      />

      {canBulk && bulk.selectionCount > 0 && (
        <BulkActionsBar
          selectedCount={bulk.selectionCount}
          onApply={bulk.handleBulkApply}
          onClearSelection={bulk.handleClearSelection}
        />
      )}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box onClickCapture={drawer.handleTableLinkClickCapture}>
          <FindingsTable
            data={data}
            selectedIds={bulk.selectedIds}
            sortField={filters.sortField}
            sortOrder={filters.sortOrder}
            onToggleAll={bulk.handleToggleAll}
            onToggleOne={bulk.handleToggleOne}
            onSortChange={handleSortChange}
            loading={loading || bulk.loading}
            errorMessage={error || bulk.error}
            onRetry={handleRetry}
            onResetFilters={actions.resetFilters}
            batchMode={bulk.selectionCount > 0}
            highlightQuery={debouncedSearch}
            rowCount={pageSize}
            onOpenDetails={(id) => openDrawer(id)}
            activeFindingId={selectedFindingId}
            returnTo={`${location.pathname}${location.search}`}
            onNavigateToDetail={() => {
              // оставляем как было (на всякий), но теперь в основном открываем Drawer
              const listPath = `${location.pathname}${location.search}`;
              sessionStorage.setItem(
                listStateKey,
                JSON.stringify({ path: listPath, scrollY: window.scrollY })
              );
            }}
            compactMode={compactMode}
          />
        </Box>

        {bulk.showSelectAllPrompt && (
          <Box px={3} pb={3}>
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={bulk.handleSelectAllResults}>
                  Выбрать все {total} результатов
                </Button>
              }
            >
              Выбрано {bulk.selectedIds.length} на странице.
            </Alert>
          </Box>
        )}

        {bulk.selectAllMatching && (
          <Box px={3} pb={3}>
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={bulk.handleClearSelection}>
                  Снять выбор
                </Button>
              }
            >
              Выбраны все {total} результатов по фильтрам.
            </Alert>
          </Box>
        )}
      </Paper>

      <PaginationControl
        page={filters.page}
        pageSize={filters.pageSize}
        total={total}
        onPageChange={(nextPage) => {
          actions.setPage(nextPage);
          if (!bulk.selectAllMatching) bulk.setSelectedIds([]);
        }}
        onPageSizeChange={(v) => {
          actions.setPageSize(v);
          if (!bulk.selectAllMatching) bulk.setSelectedIds([]);
        }}
      />

      <Snackbar
        open={bulk.undoToastOpen}
        autoHideDuration={8000}
        onClose={() => bulk.setUndoToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          onClose={() => bulk.setUndoToastOpen(false)}
          action={
            bulk.bulkUndoItems.length > 0 ? (
              <Button color="inherit" size="small" onClick={bulk.handleUndo}>
                Undo
              </Button>
            ) : null
          }
        >
          {bulk.bulkToast ?? ""}
        </Alert>
      </Snackbar>

      {/* ✅ Right Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(filters.selectedFindingId)}
        onClose={drawer.closeDrawer}
        PaperProps={{
          sx: {
            width: drawerWidth,
            maxWidth: "100vw",
            borderTopLeftRadius: isMdUp ? 16 : 0,
            borderBottomLeftRadius: isMdUp ? 16 : 0,
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Детали находки
            </Typography>

            <Stack direction="row" gap={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={drawer.openInNewTab}
                disabled={!filters.selectedFindingId}
              >
                Открыть
              </Button>
              <IconButton onClick={drawer.closeDrawer} aria-label="Закрыть">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>

          {filters.selectedFindingId && (
            <Typography variant="caption" color="text.secondary">
              ID: {filters.selectedFindingId}
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
          {filters.selectedFindingId ? (
            <FindingDetailContent id={filters.selectedFindingId} compact onClose={drawer.closeDrawer} />
          ) : null}
        </Box>
      </Drawer>
    </Container>
  );
};

export default FindingsList;
