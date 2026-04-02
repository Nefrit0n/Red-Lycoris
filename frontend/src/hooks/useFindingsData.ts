import { useCallback, useEffect, useRef, useState } from 'react';
import { buildFindingsParamsFromFilters, fetchFindings } from "../api/findings";
import { ApiError } from "../api/client";
import { FindingListItemDTO } from "../types/findings";
import { FiltersState } from '../features/filters/types';
import useDebouncedValue from './useDebouncedValue';

interface UseFindingsDataOptions {
  filters: FiltersState;
  autoLoadTotal?: boolean;
}

interface UseFindingsDataResult {
  data: FindingListItemDTO[];
  total: number | null;
  totalKnown: boolean;
  hasNextPage: boolean;
  severityCounts?: Record<string, number>;
  statusCounts?: Record<string, number>;
  loading: boolean;
  error: string | null;
  statsLoading: boolean;
  loadStats: () => Promise<void>;
  fetchData: (signal?: AbortSignal) => Promise<void>;
  handleRetry: () => void;
}

/**
 * Custom hook for fetching findings data based on filters
 * Handles loading, error states, and debounced search
 */
export function useFindingsData({
  filters,
  autoLoadTotal = true,
}: UseFindingsDataOptions): UseFindingsDataResult {
  const [data, setData] = useState<FindingListItemDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalKnown, setTotalKnown] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number> | undefined>();
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | undefined>();
  const [statsLoading, setStatsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryAttemptsRef = useRef(0);

  const debouncedSearch = useDebouncedValue(filters.search, 400);
  const filterKey = [
    filters.page,
    filters.pageSize,
    filters.productIds.join(","),
    filters.severities.join(","),
    filters.statuses.join(","),
    filters.riskBands.join(","),
    filters.occurrences.join(","),
    filters.scannerTypes.join(","),
    filters.policyDecisions.join(","),
    filters.categories.join(","),
    filters.datePreset,
    filters.dateFrom,
    filters.dateTo,
    filters.showRepeats,
    filters.sortField,
    filters.sortOrder,
    filters.importJobId,
    debouncedSearch,
  ].join("|");

  useEffect(() => {
    setHasNextPage(false);
    setTotal(null);
    setTotalKnown(false);
    setSeverityCounts(undefined);
    setStatusCounts(undefined);
  }, [filterKey]);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      const params = buildFindingsParamsFromFilters(filters, {
        searchOverride: debouncedSearch,
      });
      const requestKey = JSON.stringify(params);

      const isAutoRequest = Boolean(signal);

      if (lastRequestKeyRef.current !== requestKey) {
        retryAttemptsRef.current = 0;
      }

      if (inFlightRef.current && lastRequestKeyRef.current === requestKey) {
        return;
      }

      if (isAutoRequest && lastRequestKeyRef.current === requestKey) {
        return;
      }

      lastRequestKeyRef.current = requestKey;
      setLoading(true);
      setError(null);
      inFlightRef.current = true;

      try {
        if (retryTimeoutRef.current) {
          window.clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        const now = Date.now();
        const waitMs = cooldownUntilRef.current - now;
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          if (signal?.aborted) return;
        }

        const response = await fetchFindings(params, signal);

        if (!response || !Array.isArray(response.data)) {
          setData([]);
          setHasNextPage(false);
        } else {
          setData(response.data);
          setHasNextPage(Boolean(response.meta?.hasNext));
          if (typeof response.total === "number") {
            setTotal(response.total);
            setTotalKnown(true);
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          let errorMessage = 'Не удалось загрузить данные. Попробуйте позже.';
          if (err instanceof ApiError && (err.status === 429 || err.status === 503)) {
            const jitterMs = 300 + Math.floor(Math.random() * 500);
            cooldownUntilRef.current = Date.now() + jitterMs;
            errorMessage =
              err.status === 429
                ? "Слишком много запросов, повторяем..."
                : "Сервис перегружен, повторяем...";
            if (retryAttemptsRef.current < 2 && !signal?.aborted) {
              retryAttemptsRef.current += 1;
              retryTimeoutRef.current = window.setTimeout(() => {
                fetchData();
              }, jitterMs);
            }
          }
          if (
            err instanceof ApiError &&
            err.message &&
            !(err.status === 429 || err.status === 503)
          ) {
            errorMessage = err.message;
          }
          setError(errorMessage);
          if (!(err instanceof ApiError && (err.status === 429 || err.status === 503))) {
            setData([]);
            setHasNextPage(false);
          }
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [
      filters.page,
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
      filters.sortField,
      filters.sortOrder,
      filters.importJobId,
      debouncedSearch,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
    // Use filterKey instead of fetchData to avoid re-fetching when callback reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Auto-load total count after initial data loads
  useEffect(() => {
    if (autoLoadTotal && !totalKnown && !loading && !statsLoading && data.length > 0) {
      loadStats();
    }
    // Only run when data first loads or filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoadTotal, loading, data.length > 0]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const handleRetry = useCallback(() => {
    lastRequestKeyRef.current = null;
    fetchData();
  }, [fetchData]);

  const loadStats = useCallback(async () => {
    if (statsLoading) return;
    setStatsLoading(true);
    setError(null);
    try {
      const response = await fetchFindings(
        buildFindingsParamsFromFilters(filters, {
          includeMeta: true,
          searchOverride: debouncedSearch,
        })
      );
      if (response.meta?.severityCounts) {
        setSeverityCounts(response.meta.severityCounts);
      }
      if (response.meta?.statusCounts) {
        setStatusCounts(response.meta.statusCounts);
      }
      if (typeof response.total === "number") {
        setTotal(response.total);
        setTotalKnown(true);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof ApiError && err.message ? err.message : "Не удалось загрузить статистику.");
      }
    } finally {
      setStatsLoading(false);
    }
  }, [
    statsLoading,
    filters.page,
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
    filters.sortField,
    filters.sortOrder,
    filters.importJobId,
    debouncedSearch,
  ]);

  return {
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
  };
}
