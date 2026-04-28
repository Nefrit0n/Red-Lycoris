import { ru } from '../../i18n/ru';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import type { EnrichmentSourceDTO } from '../../types/enrichment';

export function SourceCardStale({ s }: { s: EnrichmentSourceDTO }) { return <div className='rounded-[10px] border border-amber-500/20 bg-amber-500/5 p-[14px]'><div className='text-zinc-100'>{s.source_code.toUpperCase()}</div><div className='text-3xl font-medium'>{s.records_count.toLocaleString('ru-RU')}</div><div className='mt-2 text-sm text-amber-300'>{ru.card.schedule(formatRelativeTime(s.next_run_at))}</div><button aria-label={ru.card.runNow} className='mt-2 w-full rounded border border-amber-500/30 py-1 text-amber-300'>{ru.card.runNow}</button></div>; }
