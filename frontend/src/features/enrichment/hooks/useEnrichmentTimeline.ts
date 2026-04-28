import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { TimelineEvent } from '../types/enrichment';

export function useEnrichmentTimeline() {
  return useQuery({
    queryKey: ['enrichment', 'timeline'],
    queryFn: () => apiGet<{ data: TimelineEvent[] }>('/api/v1/enrichment/timeline', { window: '2h' }).then((r) => r.data),
    refetchInterval: 30000,
  });
}
