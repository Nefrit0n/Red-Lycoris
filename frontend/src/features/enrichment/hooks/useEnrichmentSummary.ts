import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { EnrichmentSummaryDTO } from '../types/enrichment';

export function useEnrichmentSummary() {
  return useQuery({
    queryKey: ['enrichment', 'summary'],
    queryFn: () => apiGet<{ data: EnrichmentSummaryDTO }>('/api/v1/enrichment/summary').then((r) => r.data),
    refetchInterval: 30000,
  });
}
