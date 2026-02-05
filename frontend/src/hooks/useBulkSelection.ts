import { useCallback, useEffect, useState } from 'react';
import { bulkUpdateFindings } from "../api/findings";
import { Finding, FindingStatus } from '../types/findings';
import { FiltersState } from '../features/filters/types';
import { normalizeDateFrom, normalizeDateTo } from '../features/filters/api';

type BulkUndoItem = {
  id: string;
  status: FindingStatus;
};

interface UseBulkSelectionOptions {
  data: Finding[];
  total: number;
  totalKnown: boolean;
  filters: FiltersState;
  debouncedSearch: string;
  onSuccess?: () => void;
}

interface UseBulkSelectionResult {
  selectedIds: string[];
  selectAllMatching: boolean;
  bulkToast: string | null;
  undoToastOpen: boolean;
  bulkUndoItems: BulkUndoItem[];
  selectionCount: number;
  showSelectAllPrompt: boolean;
  loading: boolean;
  error: string | null;
  handleToggleAll: (checked: boolean) => void;
  handleToggleOne: (id: string) => void;
  handleClearSelection: () => void;
  handleSelectAllResults: () => void;
  handleBulkApply: (action: 'set_status' | 'assign' | 'dismiss', payload: Record<string, unknown>) => Promise<void>;
  handleUndo: () => Promise<void>;
  setUndoToastOpen: (open: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  setSelectAllMatching: (value: boolean) => void;
}

/**
 * Custom hook for managing bulk selection and actions
 */
export function useBulkSelection({
  data,
  total,
  totalKnown,
  filters,
  debouncedSearch,
  onSuccess,
}: UseBulkSelectionOptions): UseBulkSelectionResult {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkUndoItems, setBulkUndoItems] = useState<BulkUndoItem[]>([]);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [undoToastOpen, setUndoToastOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectionCount = selectAllMatching && totalKnown ? total : selectedIds.length;

  const showSelectAllPrompt =
    !selectAllMatching &&
    selectedIds.length > 0 &&
    selectedIds.length === data.length &&
    totalKnown &&
    total > data.length;

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  }, [
    filters.pageSize,
    filters.productIds,
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
    filters.search,
    filters.sortField,
    filters.sortOrder,
  ]);

  // Auto-select all when selectAllMatching is enabled
  useEffect(() => {
    if (selectAllMatching) {
      setSelectedIds(data.map((item) => item.id));
    }
  }, [data, selectAllMatching]);

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      const pageIds = data.map((item) => item.id);
      const pageIdSet = new Set(pageIds);
      if (!checked) {
        setSelectedIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
        setSelectAllMatching(false);
        return;
      }
      setSelectAllMatching(false);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return Array.from(next);
      });
    },
    [data]
  );

  const handleToggleOne = useCallback((id: string) => {
    setSelectAllMatching(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  }, []);

  const handleSelectAllResults = useCallback(() => {
    if (!totalKnown) return;
    setSelectAllMatching(true);
  }, [totalKnown]);

  const handleBulkApply = useCallback(
    async (action: 'set_status' | 'assign' | 'dismiss', payload: Record<string, unknown>) => {
      setLoading(true);
      setError(null);

      try {
        const toBulkFilter = (values: string[]) => {
          if (values.length === 0) return undefined;
          if (values.length === 1) return values[0];
          return values;
        };

        const response = await bulkUpdateFindings({
          ids: selectAllMatching ? [] : selectedIds,
          select_all: selectAllMatching,
          filters: selectAllMatching
            ? {
                product: toBulkFilter(filters.productIds),
                severity: toBulkFilter(filters.severities),
                status: toBulkFilter(filters.statuses),
                riskBand: toBulkFilter(filters.riskBands),
                occurrenceStatus: toBulkFilter(filters.occurrences),
                scannerType: toBulkFilter(filters.scannerTypes),
                policyDecision: toBulkFilter(filters.policyDecisions),
                category: toBulkFilter(filters.categories),
                q: debouncedSearch || undefined,
                dateFrom: normalizeDateFrom(filters.dateFrom),
                dateTo: normalizeDateTo(filters.dateTo),
                canonicalOnly: !filters.showRepeats,
                includeRepeats: filters.showRepeats,
              }
            : undefined,
          action,
          payload,
        });

        const undoItems =
          response?.prevStatuses?.filter(
            (item): item is BulkUndoItem => Boolean(item?.id) && Boolean(item?.status)
          ) ?? [];

        setBulkUndoItems(undoItems);
        setBulkToast(`Обновлено находок: ${response?.affectedCount ?? 0}`);
        setUndoToastOpen(true);
        setSelectedIds([]);
        setSelectAllMatching(false);

        if (onSuccess) {
          await onSuccess();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось выполнить массовую операцию');
      } finally {
        setLoading(false);
      }
    },
    [selectAllMatching, selectedIds, filters, debouncedSearch, onSuccess]
  );

  const handleUndo = useCallback(async () => {
    if (bulkUndoItems.length === 0) {
      setUndoToastOpen(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const grouped = bulkUndoItems.reduce<Record<FindingStatus, string[]>>((acc, item) => {
        const status = item.status;
        if (!acc[status]) acc[status] = [];
        acc[status].push(item.id);
        return acc;
      }, {} as Record<FindingStatus, string[]>);

      for (const [status, ids] of Object.entries(grouped)) {
        await bulkUpdateFindings({
          ids,
          action: 'set_status',
          payload: { status },
        });
      }

      setBulkToast('Изменения отменены');
      setUndoToastOpen(true);
      setBulkUndoItems([]);

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отменить изменения');
    } finally {
      setLoading(false);
    }
  }, [bulkUndoItems, onSuccess]);

  return {
    selectedIds,
    selectAllMatching,
    bulkToast,
    undoToastOpen,
    bulkUndoItems,
    selectionCount,
    showSelectAllPrompt,
    loading,
    error,
    handleToggleAll,
    handleToggleOne,
    handleClearSelection,
    handleSelectAllResults,
    handleBulkApply,
    handleUndo,
    setUndoToastOpen,
    setSelectedIds,
    setSelectAllMatching,
  };
}
