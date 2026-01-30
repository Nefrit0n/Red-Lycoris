import {
  Alert,
  Badge,
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
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ViewCompactIcon from "@mui/icons-material/ViewCompact";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { getCurrentUser } from "../api/auth";
import InlineActionsBar from "../components/InlineActionsBar";
import ExportMenu from "../components/ExportMenu";
import FiltersPanel from "../components/FiltersPanel";
import { FilterChips } from "../components/FilterChips";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import SavedViewsSelector from "../components/SavedViewsSelector";
import { useUrlFiltersSync, FiltersState } from "../hooks/useUrlFiltersSync";
import { useFindingsData } from "../hooks/useFindingsData";
import { useBulkSelection } from "../hooks/useBulkSelection";
import { useDrawerState } from "../hooks/useDrawerState";
import { useUploadRedirect } from "../hooks/useUploadRedirect";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { FindingListItemDTO } from "../types/findings";

import { FindingDetailContent } from "./FindingDetail";

const LIST_STATE_KEY = "lotus_warden_findings_list_state";

const FindingsList = () => {
  const location = useLocation();
  const isMdUp = useMediaQuery("(min-width:900px)");

  // URL <-> state
  const [filters, actions, hydrated] = useUrlFiltersSync();

  // UI only
  const [compactMode, setCompactMode] = useState(() => {
    const v = localStorage.getItem("findings.compactMode");
    return v ? v === "1" : true; // default: compact = ON
  });
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("findings.compactMode", compactMode ? "1" : "0");
  }, [compactMode]);
  
  // после загрузки (если надо) — автопереход на product
  useUploadRedirect(filters.pageSize);

  // данные
  const {
    data,
    total,
    totalKnown,
    hasNextPage,
    loading,
    error,
    statsLoading,
    loadStats,
    fetchData,
    handleRetry,
  } = useFindingsData({
    filters,
    hydrated,
  });

  // подсветка текста + bulk (в bulk уже нужен debounced)
  const debouncedSearch = useDebouncedValue(filters.searchInput, 400);

  // bulk actions
  const totalCount = totalKnown ? total ?? 0 : data.length;
  const bulk = useBulkSelection({
    data,
    total: totalCount,
    totalKnown,
    filters,
    debouncedSearch,
    onSuccess: fetchData,
  });

  // drawer
  const drawer = useDrawerState({
    selectedFindingId: filters.selectedFindingId,
    setSelectedFindingId: actions.setSelectedFindingId,
    selectionCount: bulk.selectionCount,
    listStateKey: LIST_STATE_KEY,
  });

  const listReturnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.delete("selected");
    const qs = params.toString();
    return `${location.pathname}${qs ? `?${qs}` : ""}`;
  }, [location.pathname, location.search]);

  const handleSortChange = useCallback(
    (field: keyof FindingListItemDTO) => {
      if (filters.sortField === field) {
        actions.setSortOrder(filters.sortOrder === "asc" ? "desc" : "asc");
      } else {
        actions.setSortField(field);

        const defaultOrder: "asc" | "desc" =
          field === "severity" ||
            field === "riskScore" ||
            field === "lastSeenAt" ||
            field === "createdAt" ||
            field === "updatedAt"
            ? "desc"
            : "asc";

        actions.setSortOrder(defaultOrder);
      }
      actions.setPage(0);
    },
    [actions, filters.sortField, filters.sortOrder]
  );

  const drawerWidth = isMdUp ? 620 : "100vw";
  const filtersDrawerWidth = isMdUp ? 420 : "100vw";

  const user = getCurrentUser();
  const canBulk = user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  const handleNavigateToDetail = useCallback(() => {
    const listPath = `${location.pathname}${location.search}`;
    sessionStorage.setItem(
      LIST_STATE_KEY,
      JSON.stringify({ path: listPath, scrollY: window.scrollY })
    );
  }, [location.pathname, location.search]);

  const activeFiltersCount = useMemo(() => {
    const countable = [
      filters.productId,
      filters.searchInput.trim(),
      filters.filterSeverity,
      filters.filterStatus,
      filters.filterRiskBand,
      filters.filterOccurrence,
      filters.filterScannerType,
      filters.filterPolicyDecision,
      filters.dateFrom,
      filters.dateTo,
    ];
    const baseCount = countable.filter(Boolean).length;
    return filters.showRepeats ? baseCount + 1 : baseCount;
  }, [
    filters.productId,
    filters.searchInput,
    filters.filterSeverity,
    filters.filterStatus,
    filters.filterRiskBand,
    filters.filterOccurrence,
    filters.filterScannerType,
    filters.filterPolicyDecision,
    filters.dateFrom,
    filters.dateTo,
    filters.showRepeats,
  ]);

  // Apply saved view filters
  const handleApplyView = useCallback(
    (viewFilters: Partial<FiltersState>) => {
      if (viewFilters.productId !== undefined) actions.setProductId(viewFilters.productId);
      if (viewFilters.searchInput !== undefined) actions.setSearchInput(viewFilters.searchInput);
      if (viewFilters.filterSeverity !== undefined) actions.setFilterSeverity(viewFilters.filterSeverity);
      if (viewFilters.filterStatus !== undefined) actions.setFilterStatus(viewFilters.filterStatus);
      if (viewFilters.filterRiskBand !== undefined) actions.setFilterRiskBand(viewFilters.filterRiskBand);
      if (viewFilters.filterOccurrence !== undefined) actions.setFilterOccurrence(viewFilters.filterOccurrence);
      if (viewFilters.filterScannerType !== undefined) actions.setFilterScannerType(viewFilters.filterScannerType);
      if (viewFilters.filterPolicyDecision !== undefined) {
        actions.setFilterPolicyDecision(viewFilters.filterPolicyDecision);
      }
      if (viewFilters.dateFrom !== undefined) actions.setDateFrom(viewFilters.dateFrom);
      if (viewFilters.dateTo !== undefined) actions.setDateTo(viewFilters.dateTo);
      if (viewFilters.showRepeats !== undefined) actions.setShowRepeats(viewFilters.showRepeats);
    },
    [actions]
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

        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Saved Views */}
          <SavedViewsSelector
            currentFilters={filters}
            onApplyView={handleApplyView}
          />

          {/* Export */}
          <ExportMenu
            data={data}
            filename="findings"
            disabled={loading}
            totalCount={totalCount}
            selectAllMatching={bulk.selectAllMatching}
            filters={filters}
            debouncedSearch={debouncedSearch}
          />

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

          <Tooltip title="Фильтры">
            <IconButton onClick={() => setFiltersDrawerOpen(true)} aria-label="Фильтры">
              <Badge
                badgeContent={activeFiltersCount}
                color="primary"
                overlap="circular"
                invisible={activeFiltersCount === 0}
              >
                <FilterAltIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {activeFiltersCount > 0 ? (
        <Box sx={{ mb: 2 }}>
          <FilterChips
            productId={filters.productId}
            productLabel={filters.productId}
            search={filters.searchInput}
            filterSeverity={filters.filterSeverity}
            filterStatus={filters.filterStatus}
            filterRiskBand={filters.filterRiskBand}
            filterOccurrence={filters.filterOccurrence}
            filterScannerType={filters.filterScannerType}
            filterPolicyDecision={filters.filterPolicyDecision}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            showRepeats={filters.showRepeats}
            onProductIdChange={actions.setProductId}
            onSearchChange={actions.setSearchInput}
            onSeverityChange={actions.setFilterSeverity}
            onStatusChange={actions.setFilterStatus}
            onRiskBandChange={actions.setFilterRiskBand}
            onOccurrenceChange={actions.setFilterOccurrence}
            onScannerTypeChange={actions.setFilterScannerType}
            onPolicyDecisionChange={actions.setFilterPolicyDecision}
            onDateFromChange={actions.setDateFrom}
            onDateToChange={actions.setDateTo}
            onShowRepeatsChange={actions.setShowRepeats}
          />
        </Box>
      ) : null}

      {canBulk && (
        <InlineActionsBar
          selectedCount={bulk.selectedIds.length}
          totalCount={totalCount}
          totalKnown={totalKnown}
          selectAllMatching={bulk.selectAllMatching}
          showSelectAllPrompt={bulk.showSelectAllPrompt}
          onApply={bulk.handleBulkApply}
          onClearSelection={bulk.handleClearSelection}
          onSelectAllResults={bulk.handleSelectAllResults}
          loading={bulk.loading}
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
          onOpenDetails={(id) => drawer.openDrawer(id)}
          activeFindingId={filters.selectedFindingId}
          returnTo={listReturnTo}
          onNavigateToDetail={handleNavigateToDetail}
          compactMode={compactMode}
        />

      </Paper>

      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mt: 2 }}>
        {!totalKnown && (
          <Button
            size="small"
            variant="outlined"
            onClick={loadStats}
            disabled={statsLoading || loading}
          >
            {statsLoading ? "Загрузка статистики..." : "Загрузить статистику"}
          </Button>
        )}
        <Box sx={{ flex: 1 }}>
          <PaginationControl
            page={filters.page}
            pageSize={filters.pageSize}
            total={totalKnown ? totalCount : null}
            hasNextPage={hasNextPage}
            currentCount={data.length}
            onPageChange={(nextPage) => {
              if (nextPage > filters.page && !hasNextPage) return;
              actions.setPage(nextPage);
              if (!bulk.selectAllMatching) bulk.setSelectedIds([]);
            }}
            onPageSizeChange={(v) => {
              actions.setPageSize(v);
              if (!bulk.selectAllMatching) bulk.setSelectedIds([]);
            }}
          />
        </Box>
      </Stack>

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

      <Drawer
        anchor="right"
        open={filtersDrawerOpen}
        onClose={() => setFiltersDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: filtersDrawerWidth,
            maxWidth: "100vw",
            borderTopLeftRadius: isMdUp ? 16 : 0,
            borderBottomLeftRadius: isMdUp ? 16 : 0,
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            flex: "0 0 auto",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Фильтры
            </Typography>

            <Stack direction="row" gap={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={actions.resetFilters}
              >
                Сбросить
              </Button>
              <IconButton onClick={() => setFiltersDrawerOpen(false)} aria-label="Закрыть">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ p: 2, flex: "1 1 auto", overflowY: "auto" }}>
          <FiltersPanel
            productId={filters.productId}
            search={filters.searchInput}
            filterSeverity={filters.filterSeverity}
            filterStatus={filters.filterStatus}
            filterRiskBand={filters.filterRiskBand}
            filterOccurrence={filters.filterOccurrence}
            filterScannerType={filters.filterScannerType}
            filterPolicyDecision={filters.filterPolicyDecision}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            showRepeats={filters.showRepeats}
            onProductIdChange={actions.setProductId}
            onSearchChange={actions.setSearchInput}
            onSeverityChange={actions.setFilterSeverity}
            onStatusChange={actions.setFilterStatus}
            onRiskBandChange={actions.setFilterRiskBand}
            onOccurrenceChange={actions.setFilterOccurrence}
            onScannerTypeChange={actions.setFilterScannerType}
            onPolicyDecisionChange={actions.setFilterPolicyDecision}
            onDateFromChange={actions.setDateFrom}
            onDateToChange={actions.setDateTo}
            onShowRepeatsChange={actions.setShowRepeats}
            onReset={actions.resetFilters}
            showHeader={false}
            showChips={false}
          />
        </Box>
      </Drawer>
    </Container>
  );
};

export default FindingsList;
