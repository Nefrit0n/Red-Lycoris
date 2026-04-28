import { ru } from '../../i18n/ru';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import type { EnrichmentSourceDTO } from '../../types/enrichment';
import { Sparkline } from './Sparkline';

export function SourceCardSuccess({ s }: { s: EnrichmentSourceDTO }) { return <div className='rounded-[10px] border border-green-500/20 bg-green-500/5 p-[14px]'><div className='text-zinc-100'>{s.source_code.toUpperCase()}</div><div className='text-3xl font-medium'>{s.records_count.toLocaleString('ru-RU')}</div><Sparkline points={s.sparkline_7d}/><div className='text-sm text-zinc-400'>{ru.card.lastSuccess(formatRelativeTime(s.last_sync_at))}</div></div>; }
