import type { SourceUIStatus } from '../../utils/deriveSourceStatus';

const styles: Record<SourceUIStatus, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-300',
  running: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  stale: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const labels: Record<SourceUIStatus, string> = {
  success: 'синк ✓',
  running: 'идёт',
  stale: 'устарел',
  error: 'ошибка',
};

export function StatusBadge({ status }: { status: SourceUIStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
