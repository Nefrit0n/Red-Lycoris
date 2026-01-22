import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFindings } from "../api/findings";
import { ApiError } from "../api/client";
import { FindingListItemDTO } from "../types/findings";
import { normalizeDateFrom, normalizeDateTo } from '../utils/urlHelpers';
import { FiltersState } from './useUrlFiltersSync';
import useDebouncedValue from './useDebouncedValue';

interface UseFindingsDataOptions {
  filters: FiltersState;
  hydrated: boolean;
}

interface UseFindingsDataResult {
  data: FindingListItemDTO[];
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
  const [data, setData] = useState<FindingListItemDTO[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const cooldownUntilRef = useRef(0);

  const debouncedSearch = useDebouncedValue(filters.searchInput, 400);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      const params = {
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
      };
      const requestKey = JSON.stringify(params);

      if (inFlightRef.current && lastRequestKeyRef.current === requestKey) {
        return;
      }

      lastRequestKeyRef.current = requestKey;
      setLoading(true);
      setError(null);
      inFlightRef.current = true;

      try {
        const now = Date.now();
        const waitMs = cooldownUntilRef.current - now;
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          if (signal?.aborted) return;
        }

        const response = await fetchFindings(params, signal);

        if (!response || !Array.isArray(response.data)) {
          setData([]);
          setTotal(0);
        } else {
          setData(response.data);
          setTotal(typeof response.total === 'number' ? response.total : 0);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          if (err instanceof ApiError && err.status === 503) {
            cooldownUntilRef.current = Date.now() + 800;
          }
          setError('Не удалось загрузить данные. Попробуйте позже.');
          setData([]);
          setTotal(0);
        }
      } finally {
        inFlightRef.current = false;
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
