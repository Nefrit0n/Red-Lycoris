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
  InputAdornment,
  MenuItem,
  Select,
  Snackbar,
  Slide,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { getCurrentUser } from "../api/auth";
import ExportMenu from "../components/ExportMenu";
import { FilterChips } from "../components/FilterChips";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import ViewsDropdown from "../components/ViewsDropdown";
import FilterDrawer from "../components/FilterDrawer";
import FiltersPanel from "../components/FiltersPanel";
import { primitives } from "../design-system/tokens/colors";
import { useUrlFiltersSync, FiltersState } from "../hooks/useUrlFiltersSync";
import { useFindingsData } from "../hooks/useFindingsData";
import { useBulkSelection } from "../hooks/useBulkSelection";
import { useDrawerState } from "../hooks/useDrawerState";
import { useUploadRedirect } from "../hooks/useUploadRedirect";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { FindingListItemDTO, FindingStatus } from "../types/findings";

import FindingDetailsDrawer from "../components/FindingDetailsDrawer";

const LIST_STATE_KEY = "lotus_warden_findings_list_state";

type BulkAction = "set_status";

const FindingsList = () => {
  const location = useLocation();

  // URL <-> state
  const [filters, actions, hydrated] = useUrlFiltersSync();

  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

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
  const debouncedSearch = useDebouncedValue(filters.searchInput, 400);

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
            <TextField
              value={filters.searchInput}
              onChange={(e) => actions.setSearchInput(e.target.value)}
              placeholder="Search"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: primitives.night[400] }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: 120, sm: 180 },
                "& .MuiOutlinedInput-root": {
                  height: 32,
                  bgcolor: alpha(primitives.night[700], 0.5),
                  "&:hover": {
                    bgcolor: alpha(primitives.night[600], 0.5),
                  },
                },
              }}
            />

            <ViewsDropdown currentFilters={filters} onApplyView={handleApplyView} />

            <ExportMenu
              data={data}
              filename="findings"
              disabled={loading}
              totalCount={totalCount}
              selectAllMatching={bulk.selectAllMatching}
              filters={filters}
              debouncedSearch={debouncedSearch}
            />

            <Tooltip title={`Filters${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setFiltersDrawerOpen(true)}
                startIcon={<FilterListIcon />}
                sx={{
                  minWidth: 80,
                  height: 32,
                  borderColor: activeFiltersCount > 0 ? primitives.lotus[500] : primitives.night[600],
                  color: activeFiltersCount > 0 ? primitives.lotus[400] : primitives.night[300],
                  "&:hover": {
                    borderColor: primitives.lotus[500],
                    bgcolor: alpha(primitives.lotus[500], 0.1),
                  },
                }}
              >
                {activeFiltersCount > 0 ? activeFiltersCount : "Filters"}
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* Filter Chips (if active) */}
      {activeFiltersCount > 0 && (
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1,
            borderBottom: "1px solid",
            borderColor: primitives.night[700],
            bgcolor: alpha(primitives.night[750], 0.5),
            flexShrink: 0,
          }}
        >
          <FilterChips
            productId={filters.productId}
            productLabel={filters.productLabel}
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
            onResetAll={actions.resetFilters}
          />
        </Box>
      )}

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

      {/* Filters Drawer */}
      <FilterDrawer
        open={filtersDrawerOpen}
        onClose={() => setFiltersDrawerOpen(false)}
        onReset={actions.resetFilters}
        width={{ xs: "100vw", md: 420 }}
      >
        <FiltersPanel
          productId={filters.productId}
          productLabel={filters.productLabel}
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
          onProductLabelChange={actions.setProductLabel}
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
      </FilterDrawer>
    </Box>
  );
};

export default FindingsList;
