import { ru } from '../i18n/ru';

export type SortKey = 'records' | 'lastSync' | 'name' | 'health';
export function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return <label className='text-sm text-zinc-400'>{ru.sortBy} <select value={value} onChange={(e) => onChange(e.target.value as SortKey)} className='rounded border border-white/10 bg-transparent px-2 py-1 text-zinc-200'><option value='records'>{ru.sortOptions.records}</option><option value='lastSync'>{ru.sortOptions.lastSync}</option><option value='name'>{ru.sortOptions.name}</option><option value='health'>{ru.sortOptions.health}</option></select></label>;
}
