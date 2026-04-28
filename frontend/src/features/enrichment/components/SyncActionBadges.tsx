import { Loader2, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useEnrichmentStatus, useTriggerSync } from '@/api/enrichment';

const SOURCE_CODES = ['nvd', 'epss', 'kev', 'bdu', 'osv', 'cwe', 'cpe'] as const;

const sourceNames: Record<(typeof SOURCE_CODES)[number], string> = {
  nvd: 'NVD',
  epss: 'EPSS',
  kev: 'CISA KEV',
  bdu: 'БДУ ФСТЭК',
  osv: 'OSV',
  cwe: 'CWE',
  cpe: 'CPE',
};

export function SyncActionBadges() {
  const { data } = useEnrichmentStatus();
  const trigger = useTriggerSync();

  const statuses = useMemo(() => {
    const map = new Map<string, 'running' | 'success' | 'error' | 'pending'>();
    for (const item of data?.data ?? []) {
      if (item.status === 'running' || item.status === 'success' || item.status === 'error') {
        map.set(item.source, item.status);
        continue;
      }
      map.set(item.source, 'pending');
    }
    return map;
  }, [data?.data]);

  return (
    <div className='flex flex-wrap gap-2'>
      {SOURCE_CODES.map((source) => {
        const status = statuses.get(source) ?? 'pending';
        const busy = trigger.isPending && trigger.variables === source;
        const disabled = busy || status === 'running';

        return (
          <button
            key={source}
            type='button'
            onClick={() => trigger.mutate(source)}
            disabled={disabled}
            aria-label={`Синхронизировать ${sourceNames[source]}`}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${status === 'success' ? 'border-green-500/25 bg-green-500/5 text-green-300' : ''} ${status === 'running' ? 'border-blue-500/25 bg-blue-500/5 text-blue-300' : ''} ${status === 'error' ? 'border-red-500/25 bg-red-500/5 text-red-300' : ''} ${status === 'pending' ? 'border-white/10 bg-white/[0.025] text-zinc-300' : ''} ${disabled ? 'opacity-75' : 'hover:border-white/25'}`}
          >
            {busy || status === 'running' ? <Loader2 className='size-3 animate-spin' /> : <RefreshCw className='size-3' />}
            {sourceNames[source]}
          </button>
        );
      })}
    </div>
  );
}
