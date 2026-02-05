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
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { getCurrentUser } from "../api/auth";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import { primitives } from "../design-system/tokens/colors";
import { useFiltersState } from "../hooks/useFiltersState";
import { useFindingsData } from "../hooks/useFindingsData";
import { useBulkSelection } from "../hooks/useBulkSelection";
import { useDrawerState } from "../hooks/useDrawerState";
import { useUploadRedirect } from "../hooks/useUploadRedirect";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { FindingListItemDTO, FindingStatus } from "../types/findings";
import { FiltersState } from "../features/filters/types";
import FindingsTopBar from "../features/findings/toolbar/FindingsTopBar";

import FindingDetailsDrawer from "../components/FindingDetailsDrawer";

const LIST_STATE_KEY = "lotus_warden_findings_list_state";

type BulkAction = "set_status";

const FindingsList = () => {
  const location = useLocation();

  // URL <-> state
  const { state: filters, setPartial, resetAll } = useFiltersState();

  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

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
    selectedFindingId,
    setSelectedFindingId,
    selectionCount: bulk.selectionCount,
    listStateKey: LIST_STATE_KEY,
  });

  const listReturnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.delete("selected");
    const qs = params.toString();
    return `${location.pathname}${qs ? `?${qs}` : ""}`;
  }, [location.pathname, location.search]);

  const handleApplyView = useCallback(
    (partial: Partial<FiltersState>) => {
      setPartial({ ...partial, page: 0 });
    },
    [setPartial]
  );

  const handleSortChange = useCallback(
    (field: keyof FindingListItemDTO) => {
      if (filters.sortField === field) {
        setPartial({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
      } else {
        const defaultOrder: "asc" | "desc" =
          field === "severity" ||
          field === "riskScore" ||
          field === "lastSeenAt" ||
          field === "createdAt" ||
          field === "updatedAt"
            ? "desc"
            : "asc";
        setPartial({ sortField: field, sortOrder: defaultOrder });
      }
      setPartial({ page: 0 });
    },
    [filters.sortField, filters.sortOrder, setPartial]
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
      <FindingsTopBar
        totalCount={totalCount}
        totalKnown={totalKnown}
        filters={filters}
        onSearchChange={(value) => setPartial({ search: value, page: 0 })}
        onApplyView={handleApplyView}
        exportData={data}
        exportDisabled={loading}
        exportTotalCount={totalCount}
        exportSelectAllMatching={bulk.selectAllMatching}
        debouncedSearch={debouncedSearch}
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
          onResetFilters={resetAll}
          batchMode={bulk.selectionCount > 0}
          highlightQuery={debouncedSearch}
          rowCount={filters.pageSize}
          onOpenDetails={(id) => drawer.openDrawer(id)}
          activeFindingId={selectedFindingId}
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
            setPartial({ page: nextPage });
          }}
          onPageSizeChange={(v) => {
            setPartial({ pageSize: v, page: 0 });
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
        findingId={selectedFindingId}
        returnTo={listReturnTo}
        onClose={drawer.closeDrawer}
      />

    </Box>
  );
};

export default FindingsList;
