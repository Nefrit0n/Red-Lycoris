import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/client";
import type { FindingEnrichment, FindingScore } from "@/types";

export interface EnrichmentSyncStatus {
  source: string;
  last_sync_at: string | null;
  records_count: number;
  status: "running" | "success" | "error" | string;
  error_message?: string;
  duration_seconds: number;
}

export interface EnrichmentStatusResponse {
  data: EnrichmentSyncStatus[];
}

export interface EPSSHistoryPoint {
  date: string;
  score: number;
  percentile: number;
}

export interface EPSSHistoryResponse {
  cve_id: string;
  days: number;
  points: EPSSHistoryPoint[];
}

export function useFindingEnrichments(findingId: string) {
  return useQuery({
    queryKey: ["finding-enrichments", findingId],
    queryFn: () =>
      apiGet<{ data: FindingEnrichment[] }>(
        `/api/v1/findings/${findingId}/enrichments`,
      ),
    enabled: !!findingId,
  });
}

export function useFindingScore(findingId: string) {
  return useQuery({
    queryKey: ["finding-score", findingId],
    queryFn: () =>
      apiGet<{ data: FindingScore }>(`/api/v1/findings/${findingId}/score`),
    enabled: !!findingId,
  });
}

export function useEnrichmentStatus() {
  return useQuery({
    queryKey: ["enrichment-status"],
    queryFn: () => apiGet<EnrichmentStatusResponse>("/api/v1/enrichment/status"),
    refetchInterval: 30_000,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (source: string) =>
      apiPost<void>(`/api/v1/enrichment/sync/${source}`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enrichment-status"] });
      await queryClient.refetchQueries({ queryKey: ["enrichment-status"] });
    },
  });
}

export function useEnrichFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (findingId: string) =>
      apiPost<void>(`/api/v1/findings/${findingId}/enrich`, {}),
    onSuccess: async (_data: void, findingId: string) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["finding-enrichments", findingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["finding-score", findingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["finding", findingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["findings", "v2"],
        }),
      ]);
    },
  });
}

export function useEPSSHistory(cveId: string | undefined, days: number = 90) {
  return useQuery({
    queryKey: ["epss-history", cveId, days],
    queryFn: () =>
      apiGet<{ data: EPSSHistoryResponse }>(
        "/api/v1/enrichment/epss/history",
        { cve: cveId!, days: String(days) },
      ).then((r) => r.data),
    enabled: !!cveId,
    staleTime: 5 * 60 * 1000,
  });
}
