import type { EnrichmentSourceDTO } from '../../types/enrichment';
import type { SourceUIStatus } from '../../utils/deriveSourceStatus';
import { SourceCardError } from './SourceCardError';
import { SourceCardRunning } from './SourceCardRunning';
import { SourceCardStale } from './SourceCardStale';
import { SourceCardSuccess } from './SourceCardSuccess';

export function SourceCard({ s, status }: { s: EnrichmentSourceDTO; status: SourceUIStatus }) {
  if (status === 'running') return <SourceCardRunning s={s} />;
  if (status === 'stale') return <SourceCardStale s={s} />;
  if (status === 'error') return <SourceCardError s={s} />;
  return <SourceCardSuccess s={s} />;
}
