import { ru } from '../../i18n/ru';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import type { EnrichmentSourceDTO } from '../../types/enrichment';
import { StatusBadge } from './StatusBadge';

export function SourceCardError({ s }: { s: EnrichmentSourceDTO }) {
  return <div className='rounded-[10px] border border-red-500/20 bg-red-500/5 p-[14px]'>
    <div className='flex items-center justify-between gap-2'>
      <div className='text-zinc-100'>{s.source_code.toUpperCase()}</div>
      <StatusBadge status='error' />
    </div>
    <div className='mt-2 rounded border border-red-500/20 p-2 text-sm text-red-300'>{s.last_error?.message}</div>
    <div className='text-xs text-zinc-400'>{s.last_error ? ru.error.retryAttempt(s.last_error.retry_count, s.last_error.max_retries) : ''}</div>
    <div className='text-xs text-zinc-400'>{s.last_error?.next_retry_at ? ru.error.nextAttempt(formatRelativeTime(s.last_error.next_retry_at)) : ''}</div>
    <button aria-label={ru.card.retry} className='mt-2 w-full rounded border border-red-500/30 py-1 text-red-300'>{ru.card.retry}</button>
  </div>;
}
