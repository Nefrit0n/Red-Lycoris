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
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

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
import { FindingDetailContent } from "./FindingDetail";

type FindingsFilters = {
  page: number;
  pageSize: number;
  productId: string;
  searchInput: string;
  filterSeverity: string;
  filterStatus: string;
  filterOccurrence: string;
  filterScannerType: string;
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;
  sortField: keyof Finding;
  sortOrder: "asc" | "desc";
  selectedFindingId: string | null;
};

const DEFAULT_FILTERS: FindingsFilters = {
  page: 0,
  pageSize: 20,
  productId: "",
  searchInput: "",
  filterSeverity: "",
  filterStatus: "",
  filterOccurrence: "",
  filterScannerType: "",
  dateFrom: "",
  dateTo: "",
  showRepeats: false,
  sortField: "lastSeenAt",
  sortOrder: "desc",
  selectedFindingId: null,
};

function makeActions(
  setFilters: React.Dispatch<React.SetStateAction<any>>
) {
  return {
    setPage: (page: number) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, page })),

    setPageSize: (pageSize: number) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, pageSize })),

    setProductId: (productId: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, productId, page: 0 })),

    setSearchInput: (searchInput: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, searchInput, page: 0 })),

    setFilterSeverity: (filterSeverity: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, filterSeverity, page: 0 })),

    setFilterStatus: (filterStatus: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, filterStatus, page: 0 })),

    setFilterOccurrence: (filterOccurrence: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, filterOccurrence, page: 0 })),

    setFilterScannerType: (filterScannerType: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, filterScannerType, page: 0 })),

    setDateFrom: (dateFrom: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, dateFrom, page: 0 })),

    setDateTo: (dateTo: string) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, dateTo, page: 0 })),

    setShowRepeats: (showRepeats: boolean) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, showRepeats, page: 0 })),

    setSortField: (sortField: keyof Finding) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, sortField })),

    setSortOrder: (sortOrder: "asc" | "desc") =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, sortOrder })),

    setSelectedFindingId: (selectedFindingId: string | null) =>
      setFilters((prev: any) => ({ ...DEFAULT_FILTERS, ...prev, selectedFindingId })),

    resetFilters: () => setFilters(() => ({ ...DEFAULT_FILTERS })),
  };
}

function makeNoopActions() {
  const noop = () => { };
  return {
    setPage: noop,
    setPageSize: noop,
    setProductId: noop,
    setSearchInput: noop,
    setFilterSeverity: noop,
    setFilterStatus: noop,
    setFilterOccurrence: noop,
    setFilterScannerType: noop,
    setDateFrom: noop,
    setDateTo: noop,
    setShowRepeats: noop,
    setSortField: noop,
    setSortOrder: noop,
    setSelectedFindingId: noop,
    resetFilters: noop,
  };
}

const FindingsList = () => {
  const location = useLocation();
  const isMdUp = useMediaQuery("(min-width:900px)");
  const drawerWidth = isMdUp ? 620 : "100vw";

  const listStateKey = "lotus_warden:findings_list_state";

  // ======= Получаем то, что реально возвращает useUrlFiltersSync (любой формы) =======
  const urlSync: any = useUrlFiltersSync();

  const rawFilters = urlSync?.filters ?? urlSync?.state ?? urlSync?.[0];
  const setRawFilters = urlSync?.setFilters ?? urlSync?.setState ?? urlSync?.[1];
  const hydrated = urlSync?.hydrated ?? urlSync?.[2] ?? true;

  const filters: FindingsFilters = useMemo(() => {
    return { ...DEFAULT_FILTERS, ...(rawFilters ?? {}) };
  }, [rawFilters]);

  const actions = useMemo(() => {
    // если хук уже отдаёт actions — используем их
    if (urlSync?.actions) return urlSync.actions;

    // если есть setter — собираем actions сами
    if (typeof setRawFilters === "function") return makeActions(setRawFilters);

    // иначе чтобы не падало — заглушки
    return makeNoopActions();
  }, [urlSync, setRawFilters]);

  // ======= Остальная логика =======
  useUploadRedirect(filters.pageSize);

  const { data, total, loading, error, fetchData, handleRetry } = useFindingsData({
    filters,
    hydrated,
  });

  const debouncedSearch = useDebouncedValue(filters.searchInput, 400);

  const bulk = useBulkSelection({
    data,
    total,
    filters,
    debouncedSearch,
    onSuccess: fetchData,
  });

  // Drawer state (важно: setSelectedFindingId теперь точно есть, хотя бы noop)
  const drawer = useDrawerState({
    selectedFindingId: filters.selectedFindingId,
    setSelectedFindingId: actions.setSelectedFindingId,
    selectionCount: bulk.selectionCount,
  });

  const user = getCurrentUser();
  const canBulk =
    user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  const [compactMode, setCompactMode] = useState(false);

  const openDrawer = useCallback(
    (id: string) => {
      const listPath = `${location.pathname}${location.search}`;
      sessionStorage.setItem(
        listStateKey,
        JSON.stringify({ path: listPath, scrollY: window.scrollY })
      );
      actions.setSelectedFindingId(id);
    },
    [actions, location.pathname, location.search]
  );

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
    [actions, filters.sortField, filters.sortOrder]
  );

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
        filterSeverity={filters.filterSeverity as any}
        filterStatus={filters.filterStatus as any}
        filterOccurrence={filters.filterOccurrence as any}
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
            rowCount={filters.pageSize}
            onOpenDetails={openDrawer}
            activeFindingId={filters.selectedFindingId}
            returnTo={`${location.pathname}${location.search}`}
            onNavigateToDetail={() => {
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
                <Button
                  color="inherit"
                  size="small"
                  onClick={bulk.handleSelectAllResults}
                >
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
                <Button
                  color="inherit"
                  size="small"
                  onClick={bulk.handleClearSelection}
                >
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
            <FindingDetailContent
              id={filters.selectedFindingId}
              compact
              onClose={drawer.closeDrawer}
            />
          ) : null}
        </Box>
      </Drawer>
    </Container>
  );
};

export default FindingsList;
