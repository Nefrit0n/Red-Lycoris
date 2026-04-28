import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { EnrichmentSourceDTO } from '../types/enrichment';

export function useEnrichmentSources() {
  return useQuery({
    queryKey: ['enrichment', 'sources'],
    queryFn: () => apiGet<{ data: EnrichmentSourceDTO[] }>('/api/v1/enrichment/sources').then((r) => r.data),
    refetchInterval: (q) => q.state.data?.some((s) => s.active_job_id) ? 2000 : 30000,
    staleTime: 10_000,
  });
}
