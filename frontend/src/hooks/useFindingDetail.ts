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

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        if (retryTimeoutRef.current) {
          window.clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        console.log("[FindingDetail] fetch detail", id);
        const response = await fetchFindingDetail(id, signal, { includeRiskFactors: true });
        retryAttemptsRef.current = 0;
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
              fetchDetail();
            }, jitterMs);
          }
          return;
        }

        setError("Не удалось загрузить детали находки.");
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [fetchDetail]);

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
