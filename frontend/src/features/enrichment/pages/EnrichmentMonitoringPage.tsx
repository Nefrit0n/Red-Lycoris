import { useMemo, useState } from 'react';
import { useEnrichmentSources } from '../hooks/useEnrichmentSources';
import { useEnrichmentSummary } from '../hooks/useEnrichmentSummary';
import { useEnrichmentTimeline } from '../hooks/useEnrichmentTimeline';
import { ru } from '../i18n/ru';
import { deriveSourceStatus, type SourceUIStatus } from '../utils/deriveSourceStatus';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { FilterChips, type Chip } from '../components/FilterChips';
import { KpiStrip } from '../components/KpiStrip';
import { SortDropdown, type SortKey } from '../components/SortDropdown';
import { SourceCard } from '../components/SourceCard';
import { SourceCardSkeleton } from '../components/SourceCardSkeleton';

export default function EnrichmentMonitoringPage() {
  const [chip, setChip] = useState<Chip>('all');
  const [sort, setSort] = useState<SortKey>('records');
  const { data: sources = [], isLoading } = useEnrichmentSources();
  const { data: summary } = useEnrichmentSummary();
  const { data: timeline = [] } = useEnrichmentTimeline();

  const enriched = useMemo(() => sources.map((s) => ({ s, ui: deriveSourceStatus(s, summary?.active_job?.source_code) })), [sources, summary?.active_job?.source_code]);
  const counts = useMemo(() => ({
    all: enriched.length,
    success: enriched.filter((x) => x.ui === 'success').length,
    running: enriched.filter((x) => x.ui === 'running').length,
    stale: enriched.filter((x) => x.ui === 'stale').length,
    error: enriched.filter((x) => x.ui === 'error').length,
  }), [enriched]);

  const filtered = enriched.filter((x) => chip === 'all' ? true : x.ui === chip as SourceUIStatus).sort((a,b) => {
    if (sort === 'name') return a.s.source_code.localeCompare(b.s.source_code);
    if (sort === 'lastSync') return new Date(b.s.last_sync_at ?? 0).getTime() - new Date(a.s.last_sync_at ?? 0).getTime();
    return b.s.records_count - a.s.records_count;
  });

  return <div className='space-y-4 text-zinc-100'>
    <header className='flex flex-wrap items-center justify-between gap-3'>
      <div><div className='text-xs text-zinc-400'>{ru.breadcrumb}</div><h1 className='text-3xl font-medium'>{ru.title}</h1></div>
      <div className='flex items-center gap-2'>
        <div className='rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-300'>{ru.autoUpdate(sources.some((s) => s.active_job_id) ? 2 : 30)}</div>
        <button className='rounded-md bg-[#930000] px-4 py-2 text-sm text-white'>{ru.syncStale(counts.stale)}</button>
      </div>
    </header>

    <KpiStrip summary={summary ?? undefined} sources={sources} />
    <ActivityTimeline events={timeline} />

    <div className='flex items-center justify-between gap-2'>
      <FilterChips active={chip} onChange={setChip} counts={counts} />
      <SortDropdown value={sort} onChange={setSort} />
    </div>

    <div className='grid gap-3 md:grid-cols-2'>
      {isLoading ? Array.from({ length: 6 }).map((_, i) => <SourceCardSkeleton key={i} />) : filtered.map(({ s, ui }) => <article key={s.source_code} aria-label={`Источник ${s.source_code}, статус ${ui}`}><SourceCard s={s} status={ui} /></article>)}
    </div>
  </div>;
}
