import { Box } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { FindingOccurrenceStatus, FindingSeverity, FindingStatus, PolicyDecision, RiskBand } from "../types/findings";
import FilterBar, { SavedFilterView } from "./FilterBar";
import FilterDrawer, { DraftFiltersState } from "./FilterDrawer";
import { FilterChips } from "./FilterChips";

const SAVED_FILTERS_KEY = "lw_saved_filters_findings_v1";

interface FiltersPanelProps {
  productId: string;
  productLabel: string;
  search: string;
  filterSeverity: FindingSeverity | "";
  filterStatus: FindingStatus | "";
  filterRiskBand: RiskBand | "";
  filterOccurrence: FindingOccurrenceStatus | "";
  filterScannerType: string;
  filterPolicyDecision: PolicyDecision | "";
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;
  severityCounts?: Record<string, number>;
  statusCounts?: Record<string, number>;
  onProductIdChange: (value: string) => void;
  onProductLabelChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: FindingSeverity | "") => void;
  onStatusChange: (value: FindingStatus | "") => void;
  onRiskBandChange: (value: RiskBand | "") => void;
  onOccurrenceChange: (value: FindingOccurrenceStatus | "") => void;
  onScannerTypeChange: (value: string) => void;
  onPolicyDecisionChange: (value: PolicyDecision | "") => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onShowRepeatsChange: (value: boolean) => void;
  onReset: () => void;
  showChips?: boolean;
}

const FiltersPanel = ({
  productId,
  productLabel,
  search,
  filterSeverity,
  filterStatus,
  filterRiskBand,
  filterOccurrence,
  filterScannerType,
  filterPolicyDecision,
  dateFrom,
  dateTo,
  showRepeats,
  severityCounts,
  statusCounts,
  onProductIdChange,
  onProductLabelChange,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  onRiskBandChange,
  onOccurrenceChange,
  onScannerTypeChange,
  onPolicyDecisionChange,
  onDateFromChange,
  onDateToChange,
  onShowRepeatsChange,
  onReset,
  showChips = true,
}: FiltersPanelProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  interface SavedViewWithFilters extends SavedFilterView {
    filters: DraftFiltersState;
  }

  const [savedViews, setSavedViews] = useState<SavedViewWithFilters[]>([]);
  const [selectedViewId, setSelectedViewId] = useState("default");

  const activeFilters = useMemo(
    () => ({
      productId,
      productLabel,
      search,
      filterSeverity,
      filterStatus,
      filterRiskBand,
      filterOccurrence,
      filterScannerType,
      filterPolicyDecision,
      dateFrom,
      dateTo,
      showRepeats,
    }),
    [
      productId,
      productLabel,
      search,
      filterSeverity,
      filterStatus,
      filterRiskBand,
      filterOccurrence,
      filterScannerType,
      filterPolicyDecision,
      dateFrom,
      dateTo,
      showRepeats,
    ]
  );

  const emptyDraft: DraftFiltersState = {
    productId: "",
    productLabel: "",
    search: "",
    filterSeverity: "",
    filterStatus: "",
    filterRiskBand: "",
    filterOccurrence: "",
    filterScannerType: "",
    filterPolicyDecision: "",
    dateFrom: "",
    dateTo: "",
    showRepeats: false,
  };

  const [draftFilters, setDraftFilters] = useState<DraftFiltersState>(activeFilters);

  useEffect(() => {
    if (!drawerOpen) {
      setDraftFilters(activeFilters);
    }
  }, [activeFilters, drawerOpen]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_FILTERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedViews(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Не удалось загрузить сохранённые наборы:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(savedViews));
    } catch (error) {
      console.error("Не удалось сохранить наборы:", error);
    }
  }, [savedViews]);

  const activeFiltersCount = useMemo(() => {
    const countable = [
      productId,
      search.trim(),
      filterSeverity,
      filterStatus,
      filterRiskBand,
      filterOccurrence,
      filterScannerType,
      filterPolicyDecision,
      dateFrom,
      dateTo,
    ];
    const baseCount = countable.filter(Boolean).length;
    return showRepeats ? baseCount + 1 : baseCount;
  }, [
    productId,
    search,
    filterSeverity,
    filterStatus,
    filterRiskBand,
    filterOccurrence,
    filterScannerType,
    filterPolicyDecision,
    dateFrom,
    dateTo,
    showRepeats,
  ]);

  const handleOpenDrawer = () => {
    setDraftFilters(activeFilters);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDraftFilters(activeFilters);
    setDrawerOpen(false);
  };

  const handleApplyDraft = () => {
    onProductIdChange(draftFilters.productId);
    onProductLabelChange(draftFilters.productLabel);
    onSearchChange(draftFilters.search);
    onSeverityChange(draftFilters.filterSeverity);
    onStatusChange(draftFilters.filterStatus);
    onRiskBandChange(draftFilters.filterRiskBand);
    onOccurrenceChange(draftFilters.filterOccurrence);
    onScannerTypeChange(draftFilters.filterScannerType);
    onPolicyDecisionChange(draftFilters.filterPolicyDecision);
    onDateFromChange(draftFilters.dateFrom);
    onDateToChange(draftFilters.dateTo);
    onShowRepeatsChange(draftFilters.showRepeats);
    setDrawerOpen(false);
  };

  const handleResetDraft = () => {
    setDraftFilters(emptyDraft);
  };

  const handleSaveView = (name: string) => {
    const view: SavedViewWithFilters = {
      id: `custom-${Date.now()}`,
      name,
      filters: activeFilters,
    };
    setSavedViews((prev) => [...prev, view]);
    setSelectedViewId(view.id);
  };

  const handleSelectView = (viewId: string) => {
    setSelectedViewId(viewId);
    if (viewId === "default") {
      onReset();
      return;
    }
    const selected = savedViews.find((view) => view.id === viewId);
    if (!selected) return;
    onProductIdChange(selected.filters.productId);
    onProductLabelChange(selected.filters.productLabel);
    onSearchChange(selected.filters.search);
    onSeverityChange(selected.filters.filterSeverity);
    onStatusChange(selected.filters.filterStatus);
    onRiskBandChange(selected.filters.filterRiskBand);
    onOccurrenceChange(selected.filters.filterOccurrence);
    onScannerTypeChange(selected.filters.filterScannerType);
    onPolicyDecisionChange(selected.filters.filterPolicyDecision);
    onDateFromChange(selected.filters.dateFrom);
    onDateToChange(selected.filters.dateTo);
    onShowRepeatsChange(selected.filters.showRepeats);
  };

  const handleDeleteView = (viewId: string) => {
    setSavedViews((prev) => prev.filter((view) => view.id !== viewId));
    if (selectedViewId === viewId) {
      setSelectedViewId("default");
    }
  };

  return (
    <Box>
      <FilterBar
        searchValue={search}
        onSearchChange={onSearchChange}
        activeCount={activeFiltersCount}
        onOpenFilters={handleOpenDrawer}
        onResetFilters={onReset}
        savedViews={savedViews.map(({ id, name }) => ({ id, name }))}
        selectedViewId={selectedViewId}
        onSelectView={handleSelectView}
        onDeleteView={handleDeleteView}
      >
        {showChips && activeFiltersCount > 0 ? (
          <FilterChips
            productId={productId}
            productLabel={productLabel}
            search={search}
            filterSeverity={filterSeverity}
            filterStatus={filterStatus}
            filterRiskBand={filterRiskBand}
            filterOccurrence={filterOccurrence}
            filterScannerType={filterScannerType}
            filterPolicyDecision={filterPolicyDecision}
            dateFrom={dateFrom}
            dateTo={dateTo}
            showRepeats={showRepeats}
            onProductIdChange={onProductIdChange}
            onSearchChange={onSearchChange}
            onSeverityChange={onSeverityChange}
            onStatusChange={onStatusChange}
            onRiskBandChange={onRiskBandChange}
            onOccurrenceChange={onOccurrenceChange}
            onScannerTypeChange={onScannerTypeChange}
            onPolicyDecisionChange={onPolicyDecisionChange}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
            onShowRepeatsChange={onShowRepeatsChange}
            onResetAll={onReset}
          />
        ) : null}
      </FilterBar>

      <FilterDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        onReset={handleResetDraft}
        onApply={handleApplyDraft}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        severityCounts={severityCounts}
        statusCounts={statusCounts}
        activeCount={activeFiltersCount}
        onSaveView={handleSaveView}
      />
    </Box>
  );
};

export default FiltersPanel;
