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
  autoLoadTotal?: boolean;
}

interface UseFindingsDataResult {
  data: FindingListItemDTO[];
  total: number | null;
  totalKnown: boolean;
  hasNextPage: boolean;
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
export function useFindingsData({ filters, hydrated, autoLoadTotal = true }: UseFindingsDataOptions): UseFindingsDataResult {
  const [data, setData] = useState<FindingListItemDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalKnown, setTotalKnown] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryAttemptsRef = useRef(0);

  const debouncedSearch = useDebouncedValue(filters.searchInput, 400);
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  const productIsUuid = Boolean(filters.productId && isUuid(filters.productId));
  const filterKey = [
    filters.page,
    filters.pageSize,
    filters.productId,
    filters.filterSeverity,
    filters.filterStatus,
    filters.filterRiskBand,
    filters.filterOccurrence,
    filters.filterScannerType,
    filters.filterPolicyDecision,
    filters.dateFrom,
    filters.dateTo,
    filters.showRepeats,
    filters.importJobId,
    filters.sortField,
    filters.sortOrder,
    debouncedSearch,
  ].join("|");

  useEffect(() => {
    setHasNextPage(false);
    setTotal(null);
    setTotalKnown(false);
  }, [filterKey]);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      const params = {
        limit: filters.pageSize,
        offset: filters.page * filters.pageSize,
        filterProductId: productIsUuid ? filters.productId : undefined,
        filterProduct: productIsUuid ? undefined : filters.productId,
        filterSeverity: filters.filterSeverity,
        filterStatus: filters.filterStatus,
        filterRiskBand: filters.filterRiskBand,
        filterOccurrence: filters.filterOccurrence,
        filterScannerType: filters.filterScannerType,
        filterPolicyDecision: filters.filterPolicyDecision,
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
      filters.productId,
      filters.filterSeverity,
      filters.filterStatus,
      filters.filterRiskBand,
      filters.filterOccurrence,
      filters.filterScannerType,
      filters.filterPolicyDecision,
      filters.dateFrom,
      filters.dateTo,
      filters.showRepeats,
      filters.importJobId,
      filters.sortField,
      filters.sortOrder,
      debouncedSearch,
      productIsUuid,
    ]
  );

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
    // Use filterKey instead of fetchData to avoid re-fetching when callback reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, hydrated, productIsUuid]);

  // Auto-load total count after initial data loads
  useEffect(() => {
    if (autoLoadTotal && hydrated && !totalKnown && !loading && !statsLoading && data.length > 0) {
      loadStats();
    }
    // Only run when data first loads or filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoadTotal, hydrated, loading, data.length > 0]);

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
        {
          limit: filters.pageSize,
          offset: filters.page * filters.pageSize,
          includeMeta: true,
          filterProductId: productIsUuid ? filters.productId : undefined,
          filterProduct: productIsUuid ? undefined : filters.productId,
          filterSeverity: filters.filterSeverity,
          filterStatus: filters.filterStatus,
          filterRiskBand: filters.filterRiskBand,
          filterOccurrence: filters.filterOccurrence,
          filterScannerType: filters.filterScannerType,
          filterPolicyDecision: filters.filterPolicyDecision,
          search: debouncedSearch,
          dateFrom: normalizeDateFrom(filters.dateFrom),
          dateTo: normalizeDateTo(filters.dateTo),
          canonicalOnly: !filters.showRepeats,
          includeRepeats: filters.showRepeats,
          importJobId: filters.importJobId,
          sortField: filters.sortField,
          sortOrder: filters.sortOrder,
        }
      );
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
    filters.productId,
    filters.filterSeverity,
    filters.filterStatus,
    filters.filterRiskBand,
    filters.filterOccurrence,
    filters.filterScannerType,
    filters.filterPolicyDecision,
    filters.dateFrom,
    filters.dateTo,
    filters.showRepeats,
    filters.importJobId,
    filters.sortField,
    filters.sortOrder,
    debouncedSearch,
    productIsUuid,
  ]);

  return {
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
  };
}
