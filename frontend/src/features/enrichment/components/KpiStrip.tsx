import { ru } from '../i18n/ru';
import type { EnrichmentSourceDTO, EnrichmentSummaryDTO } from '../types/enrichment';
import { KpiCard } from './KpiCard';
import { Sparkline } from './SourceCard/Sparkline';

export function KpiStrip({ summary, sources }: { summary?: EnrichmentSummaryDTO; sources: EnrichmentSourceDTO[] }) {
  const top = sources[0];
  return <div className='grid gap-3 md:grid-cols-4'>
    <KpiCard title={ru.kpi.totalRecords} value={summary?.total_records?.toLocaleString('ru-RU') ?? '—'} subtitle={ru.kpi.perDay(summary?.total_records_delta_24h ?? 0)} right={top ? <Sparkline points={top.sparkline_7d} /> : null} />
    <KpiCard title={ru.kpi.health} value={`${summary?.health_score ?? 0} %`} subtitle={`${summary?.status_counts.success ?? 0} ок`} />
    <KpiCard tone='active' title={ru.kpi.running} value={summary?.active_job?.source_code?.toUpperCase() ?? '—'} subtitle={summary?.active_job ? `${Math.round(summary.active_job.progress*100)}% · ETA ${summary.active_job.eta_seconds}s` : 'нет'} />
    <KpiCard tone='attention' title={ru.kpi.attention} value={summary?.attention_count ?? 0} subtitle='stale + error' />
  </div>;
}
