import type { ReactNode } from 'react';

export function KpiCard({ title, value, subtitle, right, tone = 'default' }: { title: string; value: ReactNode; subtitle?: string; right?: ReactNode; tone?: 'default' | 'active' | 'attention'; }) {
  const tones = {
    default: 'border-white/10 bg-white/[0.025]',
    active: 'border-blue-500/20 bg-blue-500/5',
    attention: 'border-amber-500/20 bg-amber-500/5',
  };
  return <div className={`rounded-[10px] border p-[14px] ${tones[tone]}`}><div className='text-xs text-zinc-400'>{title}</div><div className='mt-1 text-3xl font-medium text-zinc-100'>{value}</div><div className='mt-1 text-sm text-zinc-400'>{subtitle}</div>{right}</div>;
}
