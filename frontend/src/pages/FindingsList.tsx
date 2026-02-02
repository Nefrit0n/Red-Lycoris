import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import SecurityIcon from "@mui/icons-material/Security";
import AssignmentLateOutlinedIcon from "@mui/icons-material/AssignmentLateOutlined";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getCurrentUser } from "../api/auth";
import InlineActionsBar from "../components/InlineActionsBar";
import ExportMenu from "../components/ExportMenu";
import { FilterChips } from "../components/FilterChips";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import ViewsDropdown from "../components/ViewsDropdown";
import FilterDrawer from "../components/FilterDrawer";
import FiltersPanel from "../components/FiltersPanel";
import { MetricDisplay } from "../design-system/components";
import { useUrlFiltersSync, FiltersState } from "../hooks/useUrlFiltersSync";
import { useFindingsData } from "../hooks/useFindingsData";
import { useBulkSelection } from "../hooks/useBulkSelection";
import { useDrawerState } from "../hooks/useDrawerState";
import { useUploadRedirect } from "../hooks/useUploadRedirect";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { FindingListItemDTO } from "../types/findings";

import FindingDetailsDrawer from "../components/FindingDetailsDrawer";

const LIST_STATE_KEY = "lotus_warden_findings_list_state";
const VIEW_MODE_KEY = "findingsViewMode";

type ViewMode = "table" | "cards";

const FindingsList = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // URL <-> state
  const [filters, actions, hydrated] = useUrlFiltersSync();

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY) as ViewMode;
    return stored === "cards" ? "cards" : "table";
  });

  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const handleViewChange = (_: React.MouseEvent, newView: ViewMode | null) => {
    if (!newView) return;
    setViewMode(newView);
    localStorage.setItem(VIEW_MODE_KEY, newView);
  };

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

  const handleUploadScan = () => {
    navigate("/scans/upload");
  };

  // Calculate metrics from data
  const metrics = useMemo(() => {
    if (loading || data.length === 0) {
      return {
        totalFindings: totalKnown && total ? total : null,
        criticalCount: null,
        highCount: null,
        openCount: null,
      };
    }

    const criticalCount = data.filter((f) => f.severity === "critical").length;
    const highCount = data.filter((f) => f.severity === "high").length;
    const openCount = data.filter(
      (f) => f.status === "new" || f.status === "under_review" || f.status === "confirmed"
    ).length;

    return {
      totalFindings: totalKnown && total ? total : data.length,
      criticalCount,
      highCount,
      openCount,
    };
  }, [data, loading, total, totalKnown]);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={4}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={3}
          alignItems={{ xs: "flex-start", lg: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Findings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Security vulnerabilities and issues across all products.
            </Typography>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewChange}
              size="small"
              aria-label="view mode"
              sx={{
                bgcolor: alpha(theme.palette.common.white, 0.04),
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <ToggleButton value="table" aria-label="table view">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="cards" aria-label="cards view" disabled>
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>

            <TextField
              value={filters.searchInput}
              onChange={(e) => actions.setSearchInput(e.target.value)}
              placeholder="Search findings"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: "100%", sm: 220 } }}
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
                  minWidth: 100,
                  ...(activeFiltersCount > 0 && {
                    borderColor: "primary.main",
                    color: "primary.main",
                  }),
                }}
              >
                Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
              </Button>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={<UploadFileOutlinedIcon />}
              sx={{ whiteSpace: "nowrap" }}
              onClick={handleUploadScan}
            >
              Upload scan
            </Button>
          </Stack>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon fontSize="small" />}
            sx={{
              borderRadius: 2,
              border: "1px solid",
              borderColor: "error.main",
              bgcolor: alpha(theme.palette.error.main, 0.1),
            }}
          >
            {error}
          </Alert>
        )}

        {/* Overview Metrics */}
        <Box>
          <Typography variant="overline" color="text.secondary">
            Overview
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <MetricDisplay
              title="Total Findings"
              value={metrics.totalFindings ?? "—"}
              loading={loading}
              size="small"
              variant="subtle"
              color="default"
              icon={<BugReportOutlinedIcon />}
            />
            <MetricDisplay
              title="Critical"
              value={metrics.criticalCount ?? "—"}
              loading={loading}
              size="small"
              variant="subtle"
              color="error"
              icon={<SecurityIcon />}
            />
            <MetricDisplay
              title="High"
              value={metrics.highCount ?? "—"}
              loading={loading}
              size="small"
              variant="subtle"
              color="warning"
              icon={<WarningAmberOutlinedIcon />}
            />
            <MetricDisplay
              title="Requires Action"
              value={metrics.openCount ?? "—"}
              loading={loading}
              size="small"
              variant="subtle"
              color="lotus"
              icon={<AssignmentLateOutlinedIcon />}
            />
          </Box>
        </Box>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
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
            onResetAll={actions.resetFilters}
          />
        )}

        <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.08) }} />

        {/* Bulk Actions Bar */}
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

        {/* Table */}
        <Box
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: alpha(theme.palette.common.white, 0.02),
            overflow: "hidden",
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
          />
        </Box>

        {/* Pagination */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          {!totalKnown && (
            <Button
              size="small"
              variant="outlined"
              onClick={loadStats}
              disabled={statsLoading || loading}
            >
              {statsLoading ? "Loading stats..." : "Load statistics"}
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
              }}
              onPageSizeChange={(v) => {
                actions.setPageSize(v);
                bulk.handleClearSelection();
              }}
            />
          </Box>
        </Stack>
      </Stack>

      {/* Snackbar for bulk operations */}
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
      </FilterDrawer>
    </Container>
  );
};

export default FindingsList;
