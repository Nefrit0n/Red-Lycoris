import type { TimelineEvent } from '../types/enrichment';
import { ru } from '../i18n/ru';

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return <section aria-label='Активность за последние 2 часа' className='rounded-[10px] border border-white/[0.06] bg-white/[0.025] p-[14px]'>
    <h3 className='mb-3 text-zinc-100'>{ru.timeline.title}</h3>
    <div className='space-y-2'>{events.map((e) => <div key={e.job_id} role='img' aria-label={`${e.source_code}: ${e.duration_ms ?? 0}, ${e.status}`} className='flex items-center gap-2'>
      <div className='w-[60px] text-xs text-zinc-400'>{e.source_code.toUpperCase()}</div>
      <div className='h-3 flex-1 rounded bg-zinc-900'><div className={`h-3 rounded ${e.status === 'failed' ? 'bg-red-500' : e.status === 'running' ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${Math.min(((e.duration_ms ?? 0) / 120000) * 100, 100)}%` }} /></div>
    </div>)}</div>
  </section>;
}
