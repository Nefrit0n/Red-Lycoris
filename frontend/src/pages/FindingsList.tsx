/**
 * FindingsList - Triage-focused findings page
 *
 * Design principles:
 * - Maximum space for findings table (edge-to-edge)
 * - Compact single-row toolbar (never shifts)
 * - Selection bar as fixed bottom overlay
 * - No distracting metrics/overview - this is a work page
 */

import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Slide,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { getCurrentUser } from "../api/auth";
import ExportMenu from "../components/ExportMenu";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import FiltersBar from "../components/FiltersBar";
import FilterDrawer, { DraftFiltersState } from "../components/FilterDrawer";
import { primitives } from "../design-system/tokens/colors";
import { useFiltersState } from "../hooks/useFiltersState";
import { useFindingsData } from "../hooks/useFindingsData";
import { useBulkSelection } from "../hooks/useBulkSelection";
import { useDrawerState } from "../hooks/useDrawerState";
import { useUploadRedirect } from "../hooks/useUploadRedirect";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { FindingListItemDTO, FindingStatus } from "../types/findings";
import { FiltersState } from "../types/filters";
import { countActiveFilters } from "../utils/filters";

import FindingDetailsDrawer from "../components/FindingDetailsDrawer";

const LIST_STATE_KEY = "lotus_warden_findings_list_state";

type BulkAction = "set_status";

const FindingsList = () => {
  const location = useLocation();

  // URL <-> state
  const [filters, actions, hydrated] = useFiltersState();

  // Bulk action state
  const [bulkStatus, setBulkStatus] = useState<FindingStatus>("under_review");

  // Auto-redirect after upload
  useUploadRedirect(filters.pageSize);

  // Data fetching
  const {
    data,
    total,
    totalKnown,
    hasNextPage,
    severityCounts,
    statusCounts,
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

  // Debounced search for highlighting
  const debouncedSearch = useDebouncedValue(filters.search, 400);

  // Bulk actions
  const totalCount = totalKnown ? total ?? 0 : data.length;
  const bulk = useBulkSelection({
    data,
    total: totalCount,
    totalKnown,
    filters,
    debouncedSearch,
    onSuccess: fetchData,
  });

  // Drawer state
  const drawer = useDrawerState({
    selectedFindingId: filters.selectedFindingId,
    setSelectedFindingId: actions.setSelectedFindingId,
    selectionCount: bulk.selectionCount,
    listStateKey: LIST_STATE_KEY,
  });

  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const activeFiltersDraft: DraftFiltersState = useMemo(
    () => ({
      productIds: filters.productIds,
      search: filters.search,
      severities: filters.severities,
      statuses: filters.statuses,
      riskBands: filters.riskBands,
      occurrences: filters.occurrences,
      scannerTypes: filters.scannerTypes,
      policyDecisions: filters.policyDecisions,
      categories: filters.categories,
      datePreset: filters.datePreset,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      showRepeats: filters.showRepeats,
    }),
    [
      filters.productIds,
      filters.search,
      filters.severities,
      filters.statuses,
      filters.riskBands,
      filters.occurrences,
      filters.scannerTypes,
      filters.policyDecisions,
      filters.categories,
      filters.datePreset,
      filters.dateFrom,
      filters.dateTo,
      filters.showRepeats,
    ]
  );

  const [draftFilters, setDraftFilters] = useState<DraftFiltersState>(activeFiltersDraft);

  useEffect(() => {
    if (!filtersDrawerOpen) {
      setDraftFilters(activeFiltersDraft);
    }
  }, [activeFiltersDraft, filtersDrawerOpen]);

  const handleOpenFilters = () => {
    setDraftFilters(activeFiltersDraft);
    setFiltersDrawerOpen(true);
  };

  const handleCloseFilters = () => {
    setDraftFilters(activeFiltersDraft);
    setFiltersDrawerOpen(false);
  };

  const handleApplyFilters = () => {
    actions.setProductIds(draftFilters.productIds);
    actions.setSearch(draftFilters.search);
    actions.setSeverities(draftFilters.severities);
    actions.setStatuses(draftFilters.statuses);
    actions.setRiskBands(draftFilters.riskBands);
    actions.setOccurrences(draftFilters.occurrences);
    actions.setScannerTypes(draftFilters.scannerTypes);
    actions.setPolicyDecisions(draftFilters.policyDecisions);
    actions.setCategories(draftFilters.categories);
    actions.setDatePreset(draftFilters.datePreset);
    actions.setDateFrom(draftFilters.dateFrom);
    actions.setDateTo(draftFilters.dateTo);
    actions.setShowRepeats(draftFilters.showRepeats);
    setFiltersDrawerOpen(false);
  };

  const handleResetDraft = () => {
    setDraftFilters({
      productIds: [],
      search: "",
      severities: [],
      statuses: [],
      riskBands: [],
      occurrences: [],
      scannerTypes: [],
      policyDecisions: [],
      categories: [],
      datePreset: "",
      dateFrom: "",
      dateTo: "",
      showRepeats: false,
    });
  };

  const handleApplyView = (partial: Partial<FiltersState>) => {
    if (partial.productIds) actions.setProductIds(partial.productIds);
    if (partial.search !== undefined) actions.setSearch(partial.search);
    if (partial.severities) actions.setSeverities(partial.severities);
    if (partial.statuses) actions.setStatuses(partial.statuses);
    if (partial.riskBands) actions.setRiskBands(partial.riskBands);
    if (partial.occurrences) actions.setOccurrences(partial.occurrences);
    if (partial.scannerTypes) actions.setScannerTypes(partial.scannerTypes);
    if (partial.policyDecisions) actions.setPolicyDecisions(partial.policyDecisions);
    if (partial.categories) actions.setCategories(partial.categories);
    if (partial.datePreset !== undefined) actions.setDatePreset(partial.datePreset);
    if (partial.dateFrom !== undefined) actions.setDateFrom(partial.dateFrom);
    if (partial.dateTo !== undefined) actions.setDateTo(partial.dateTo);
    if (partial.showRepeats !== undefined) actions.setShowRepeats(partial.showRepeats);
  };

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

  const user = getCurrentUser();
  const canBulk = user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  const handleNavigateToDetail = useCallback(() => {
    const listPath = `${location.pathname}${location.search}`;
    sessionStorage.setItem(
      LIST_STATE_KEY,
      JSON.stringify({ path: listPath, scrollY: window.scrollY })
    );
  }, [location.pathname, location.search]);

  // Handle bulk apply
  const handleBulkApply = () => {
    bulk.handleBulkApply("set_status" as BulkAction, { status: bulkStatus });
  };

  // Effective selection count
  const effectiveCount = bulk.selectAllMatching && totalKnown ? totalCount : bulk.selectedIds.length;
  const hasSelection = effectiveCount > 0;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Compact Toolbar - Single row, never shifts */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: primitives.night[700],
          bgcolor: primitives.night[800],
          flexShrink: 0,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
        >
          {/* Left: Title + count */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography
              variant="h6"
              component="h1"
              sx={{
                fontWeight: 600,
                color: primitives.night[100],
                flexShrink: 0,
              }}
            >
              Findings
            </Typography>
            {totalKnown && (
              <Typography variant="caption" sx={{ color: primitives.night[500] }}>
                {totalCount}
              </Typography>
            )}
          </Stack>

          {/* Right: Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            <ExportMenu
              data={data}
              filename="findings"
              disabled={loading}
              totalCount={totalCount}
              selectAllMatching={bulk.selectAllMatching}
              filters={filters}
              debouncedSearch={debouncedSearch}
            />
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
        <FiltersBar
          filters={filters}
          onSearchChange={actions.setSearch}
          onOpenFilters={handleOpenFilters}
          onResetFilters={actions.resetAll}
          onApplyPreset={actions.applyPreset}
          onApplyView={handleApplyView}
          onProductIdsChange={actions.setProductIds}
          onSeveritiesChange={actions.setSeverities}
          onStatusesChange={actions.setStatuses}
          onRiskBandsChange={actions.setRiskBands}
          onOccurrencesChange={actions.setOccurrences}
          onScannerTypesChange={actions.setScannerTypes}
          onPolicyDecisionsChange={actions.setPolicyDecisions}
          onCategoriesChange={actions.setCategories}
          onDatePresetChange={actions.setDatePreset}
          onDateFromChange={actions.setDateFrom}
          onDateToChange={actions.setDateTo}
          onShowRepeatsChange={actions.setShowRepeats}
        />
      </Box>

      <FilterDrawer
        open={filtersDrawerOpen}
        onClose={handleCloseFilters}
        onReset={handleResetDraft}
        onApply={handleApplyFilters}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        severityCounts={severityCounts}
        statusCounts={statusCounts}
        activeCount={countActiveFilters(filters)}
      />

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          icon={<ErrorOutlineIcon fontSize="small" />}
          sx={{
            mx: { xs: 2, md: 3 },
            mt: 1,
            borderRadius: 1,
            flexShrink: 0,
          }}
        >
          {error}
        </Alert>
      )}

      {/* Table - Takes all remaining space */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
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
          compactMode
          selectAllMatching={bulk.selectAllMatching}
        />
      </Box>

      {/* Pagination Footer */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 1,
          borderTop: "1px solid",
          borderColor: primitives.night[700],
          bgcolor: primitives.night[800],
          flexShrink: 0,
        }}
      >
        <PaginationControl
          page={filters.page}
          pageSize={filters.pageSize}
          total={totalKnown ? totalCount : null}
          hasNextPage={hasNextPage}
          currentCount={data.length}
          onPageChange={(nextPage) => {
            if (nextPage > filters.page && !hasNextPage) return;
            actions.setPage(nextPage);
          }}
          onPageSizeChange={(v) => {
            actions.setPageSize(v);
            bulk.handleClearSelection();
          }}
          loading={statsLoading}
        />
      </Box>

      {/* Fixed Bottom Selection Bar - slides up when items selected */}
      <Slide direction="up" in={canBulk && hasSelection} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            bgcolor: primitives.night[800],
            borderTop: "1px solid",
            borderColor: primitives.night[600],
            boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            spacing={3}
            sx={{ px: 3, py: 1.5 }}
          >
            {/* Selection count */}
            <Typography
              variant="body2"
              sx={{
                color: primitives.lotus[400],
                fontWeight: 600,
              }}
            >
              {bulk.selectAllMatching && totalKnown
                ? `${totalCount} selected`
                : `${bulk.selectedIds.length} selected`}
            </Typography>

            {/* Select all link */}
            {bulk.showSelectAllPrompt && !bulk.selectAllMatching && totalKnown && totalCount > data.length && (
              <Typography
                component="span"
                variant="body2"
                onClick={bulk.handleSelectAllResults}
                sx={{
                  color: primitives.night[300],
                  cursor: "pointer",
                  textDecoration: "underline",
                  "&:hover": { color: primitives.lotus[400] },
                }}
              >
                Select all {totalCount}
              </Typography>
            )}

            <Box sx={{ height: 24, width: 1, bgcolor: primitives.night[600] }} />

            {/* Status selector */}
            <FormControl size="small">
              <Select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as FindingStatus)}
                sx={{
                  height: 36,
                  minWidth: 150,
                  bgcolor: primitives.night[700],
                  "& .MuiSelect-select": { py: 0.75 },
                }}
              >
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="under_review">Under review</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="false_positive">False positive</MenuItem>
                <MenuItem value="out_of_scope">Out of scope</MenuItem>
                <MenuItem value="risk_accepted">Risk accepted</MenuItem>
                <MenuItem value="mitigated">Mitigated</MenuItem>
                <MenuItem value="duplicate">Duplicate</MenuItem>
              </Select>
            </FormControl>

            {/* Apply button */}
            <Button
              variant="contained"
              size="small"
              onClick={handleBulkApply}
              disabled={bulk.loading}
              startIcon={<CheckIcon />}
              sx={{
                bgcolor: primitives.lotus[500],
                color: "#fff",
                height: 36,
                "&:hover": { bgcolor: primitives.lotus[600] },
                "&.Mui-disabled": { bgcolor: primitives.night[600] },
              }}
            >
              Apply
            </Button>

            {/* Clear selection */}
            <Tooltip title="Clear selection">
              <IconButton
                size="small"
                onClick={bulk.handleClearSelection}
                sx={{
                  color: primitives.night[400],
                  "&:hover": { color: primitives.night[200], bgcolor: alpha(primitives.night[600], 0.5) },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Slide>

      {/* Snackbar for bulk operations */}
      <Snackbar
        open={bulk.undoToastOpen}
        autoHideDuration={8000}
        onClose={() => bulk.setUndoToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ mb: hasSelection ? 8 : 0 }} // Move up when selection bar is visible
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

      {/* Finding Details Drawer */}
      <FindingDetailsDrawer
        findingId={filters.selectedFindingId}
        returnTo={listReturnTo}
        onClose={drawer.closeDrawer}
      />

    </Box>
  );
};

export default FindingsList;
