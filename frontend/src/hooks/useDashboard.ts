import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboard } from "../api/dashboard";
import type { DashboardData } from "../types/dashboard";

const REFRESH_INTERVAL = 60_000;

interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (isInitial = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isInitial) setLoading(true);
    setError(null);

    try {
      const result = await fetchDashboard(controller.signal);
      setData(result);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(false), REFRESH_INTERVAL);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [load]);

  const refresh = useCallback(() => load(false), [load]);

  return { data, loading, error, refresh };
}
