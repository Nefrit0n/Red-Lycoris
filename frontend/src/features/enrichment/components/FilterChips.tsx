import type { SourceUIStatus } from '../utils/deriveSourceStatus';
import { ru } from '../i18n/ru';

export type Chip = 'all' | SourceUIStatus;

export function FilterChips({ active, onChange, counts }: { active: Chip; onChange: (c: Chip) => void; counts: Record<Chip, number> }) {
  const labels: Record<Chip, string> = { all: ru.chips.all, success: ru.chips.success, running: ru.chips.running, error: ru.chips.error, stale: ru.chips.stale };
  return <div role='tablist' className='flex gap-2'>{(Object.keys(labels) as Chip[]).map((k) => <button key={k} role='tab' aria-selected={active === k} onClick={() => onChange(k)} className={`rounded-full border px-3 py-1 text-sm ${active === k ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 text-zinc-400'}`}>{labels[k]} · {counts[k] ?? 0}</button>)}</div>;
}
