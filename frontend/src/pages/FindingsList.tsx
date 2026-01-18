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
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useCallback } from "react";
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

// 👇 важно: нужен экспорт FindingDetailContent из FindingDetail.tsx
import { FindingDetailContent } from "./FindingDetail";

const FindingsList = () => {
  const location = useLocation();
  const isMdUp = useMediaQuery("(min-width:900px)");

  // Sync URL with filters state
  const [filters, actions, hydrated] = useUrlFiltersSync();

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
      <Typography variant="h4" component="h1" gutterBottom>
        Список находок
      </Typography>

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
            rowCount={filters.pageSize}
            onOpenDetail={drawer.openDrawer}
            activeId={filters.selectedFindingId}
            returnTo={`${location.pathname}${location.search}`}
            onNavigateToDetail={drawer.openDrawer}
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
