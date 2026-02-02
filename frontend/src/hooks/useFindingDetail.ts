import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFindingDetail } from "../api/findings";
import { ApiError } from "../api/client";
import { FindingDetailDTO } from "../types/findings";

interface UseFindingDetailResult {
  data: FindingDetailDTO | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching finding detail
 */
export function useFindingDetail(id: string): UseFindingDetailResult {
  const [data, setData] = useState<FindingDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryAttemptsRef = useRef(0);
  const lastFetchedIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal, force = false) => {
      // Prevent duplicate requests for the same ID
      if (!force && lastFetchedIdRef.current === id && data !== null) {
        return;
      }

      // Prevent concurrent requests for the same ID
      if (inFlightRef.current && lastFetchedIdRef.current === id) {
        return;
      }

      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        if (retryTimeoutRef.current) {
          window.clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        const response = await fetchFindingDetail(id, signal, { includeRiskFactors: true });
        retryAttemptsRef.current = 0;
        lastFetchedIdRef.current = id;
        setData(response);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }

        if (e instanceof ApiError && (e.status === 429 || e.status === 503)) {
          const jitterMs = 300 + Math.floor(Math.random() * 500);
          setError(e.status === 429 ? "Слишком много запросов, повторяем..." : "Сервис перегружен, повторяем...");
          if (retryAttemptsRef.current < 2 && !signal?.aborted) {
            retryAttemptsRef.current += 1;
            retryTimeoutRef.current = window.setTimeout(() => {
              fetchDetail(undefined, true);
            }, jitterMs);
          }
          return;
        }

        setError("Не удалось загрузить детали находки.");
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [id, data]
  );

  useEffect(() => {
    // Reset state when ID changes
    if (lastFetchedIdRef.current !== id) {
      setData(null);
      setLoading(true);
      setError(null);
    }

    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    retryAttemptsRef.current = 0;
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const refetch = useCallback(async () => {
    await fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch };
}
