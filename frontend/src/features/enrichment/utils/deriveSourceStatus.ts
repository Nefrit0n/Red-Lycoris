import type { EnrichmentSourceDTO } from '../types/enrichment';
import { cronToMs } from './cronToMs';

export type SourceUIStatus = 'success' | 'running' | 'stale' | 'error';

export function deriveSourceStatus(s: EnrichmentSourceDTO, activeJobSourceCode?: string): SourceUIStatus {
  if (s.source_code === activeJobSourceCode) return 'running';
  if (s.last_error) return 'error';
  if (!s.last_sync_at) return 'stale';
  const lastSyncMs = Date.now() - new Date(s.last_sync_at).getTime();
  const expectedMs = cronToMs(s.schedule_cron);
  if (lastSyncMs > expectedMs * 2) return 'stale';
  return 'success';
}
