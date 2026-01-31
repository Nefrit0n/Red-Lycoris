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
export function useFindingsData({ filters, hydrated }: UseFindingsDataOptions): UseFindingsDataResult {
  const [data, setData] = useState<FindingListItemDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalKnown, setTotalKnown] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorsByPage, setCursorsByPage] = useState<Record<number, string>>({});
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
    filters.pageSize,
    filters.productId,
    filters.filterSeverity,
    filters.filterStatus,
    filters.filterRiskBand,
    filters.filterOccurrence,
    filters.filterScannerType,
    filters.filterPolicyDecision,
    filters.searchInput,
    filters.dateFrom,
    filters.dateTo,
    filters.showRepeats,
    filters.importJobId,
    filters.sortField,
    filters.sortOrder,
  ].join("|");

  useEffect(() => {
    setCursorsByPage({});
    setNextCursor(null);
    setTotal(null);
    setTotalKnown(false);
  }, [filterKey]);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      const cursor = filters.page === 0 ? undefined : cursorsByPage[filters.page - 1];
      const params = {
        limit: filters.pageSize,
        cursor,
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

      if (filters.page > 0 && !cursor) {
        setError("Недоступна следующая страница. Обновите список.");
        setData([]);
        setLoading(false);
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
          setNextCursor(null);
        } else {
          setData(response.data);
          setNextCursor(response.nextCursor ?? null);
          if (response.nextCursor) {
            setCursorsByPage((prev) => ({ ...prev, [filters.page]: response.nextCursor! }));
          }
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
            setNextCursor(null);
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
      cursorsByPage,
      productIsUuid,
    ]
  );

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, hydrated]);

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
      const cursor = filters.page === 0 ? undefined : cursorsByPage[filters.page - 1];
      const response = await fetchFindings(
        {
          limit: filters.pageSize,
          cursor,
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
      cursorsByPage,
      productIsUuid,
    ]);

  return {
    data,
    total,
    totalKnown,
    hasNextPage: Boolean(nextCursor),
    loading,
    error,
    statsLoading,
    loadStats,
    fetchData,
    handleRetry,
  };
}
