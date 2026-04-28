import { ru } from '../../i18n/ru';
import type { EnrichmentSourceDTO } from '../../types/enrichment';
import { StatusBadge } from './StatusBadge';

export function SourceCardRunning({ s, progress = 0.3 }: { s: EnrichmentSourceDTO; progress?: number }) {
  return <div className='rounded-[10px] border border-blue-500/20 bg-blue-500/5 p-[14px]'>
    <div className='flex items-center justify-between gap-2'>
      <div className='text-zinc-100'>{s.source_code.toUpperCase()}</div>
      <StatusBadge status='running' />
    </div>
    <div className='text-3xl font-medium'>{s.records_count.toLocaleString('ru-RU')}</div>
    <div role='progressbar' aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress*100} className='mt-2 h-2 rounded bg-blue-950'><div className='h-2 rounded bg-blue-500' style={{width:`${progress*100}%`}}/></div>
    <div className='mt-2 text-sm text-blue-300'>{Math.round(progress*100)}%</div>
    <button aria-label={ru.card.abort} className='mt-2 w-full rounded border border-red-500/20 py-1 text-red-400'>{ru.card.abort}</button>
  </div>;
}
