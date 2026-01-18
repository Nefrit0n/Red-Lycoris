import { useCallback, useEffect, useState } from "react";
import { fetchFindingDetail } from "../api/findings";
import { FindingDetail } from "../types/findings";

interface UseFindingDetailResult {
  data: FindingDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching finding detail
 */
export function useFindingDetail(id: string): UseFindingDetailResult {
  const [data, setData] = useState<FindingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchFindingDetail(id, signal);
        setData(response);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError("Не удалось загрузить детали находки.");
        }
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

  const refetch = useCallback(async () => {
    await fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch };
}
