import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/client";
import type {
  FindingEnrichment,
  FindingScore,
  EnrichmentStatusResponse,
} from "@/types";

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