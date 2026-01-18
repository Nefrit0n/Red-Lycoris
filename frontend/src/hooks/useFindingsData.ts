import { useCallback, useEffect, useState } from 'react';
import { fetchFindings } from '../api/findings';
import { Finding } from '../types/findings';
import { normalizeDateFrom, normalizeDateTo } from '../utils/urlHelpers';
import { FiltersState } from './useUrlFiltersSync';
import useDebouncedValue from './useDebouncedValue';

interface UseFindingsDataOptions {
  filters: FiltersState;
  hydrated: boolean;
}

interface UseFindingsDataResult {
  data: Finding[];
  total: number;
  loading: boolean;
  error: string | null;
  fetchData: (signal?: AbortSignal) => Promise<void>;
  handleRetry: () => void;
}

/**
 * Custom hook for fetching findings data based on filters
 * Handles loading, error states, and debounced search
 */
export function useFindingsData({ filters, hydrated }: UseFindingsDataOptions): UseFindingsDataResult {
  const [data, setData] = useState<Finding[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(filters.searchInput, 400);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchFindings(
          {
            limit: filters.pageSize,
            offset: filters.page * filters.pageSize,
            filterProduct: filters.productId,
            filterSeverity: filters.filterSeverity,
            filterStatus: filters.filterStatus,
            filterOccurrence: filters.filterOccurrence,
            filterScannerType: filters.filterScannerType,
            search: debouncedSearch,
            dateFrom: normalizeDateFrom(filters.dateFrom),
            dateTo: normalizeDateTo(filters.dateTo),
            canonicalOnly: !filters.showRepeats,
            includeRepeats: filters.showRepeats,
            importJobId: filters.importJobId,
            sortField: filters.sortField,
            sortOrder: filters.sortOrder,
          },
          signal
        );

        if (!response || !Array.isArray(response.data)) {
          setData([]);
          setTotal(0);
        } else {
          setData(response.data);
          setTotal(typeof response.total === 'number' ? response.total : 0);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Не удалось загрузить данные. Попробуйте позже.');
          setData([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      filters.page,
      filters.pageSize,
      filters.productId,
      filters.filterSeverity,
      filters.filterStatus,
      filters.filterOccurrence,
      filters.filterScannerType,
      filters.dateFrom,
      filters.dateTo,
      filters.showRepeats,
      filters.importJobId,
      filters.sortField,
      filters.sortOrder,
      debouncedSearch,
    ]
  );

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, hydrated]);

  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    total,
    loading,
    error,
    fetchData,
    handleRetry,
  };
}
