import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/client";
import type { FindingEnrichment, FindingScore } from "@/types";

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
