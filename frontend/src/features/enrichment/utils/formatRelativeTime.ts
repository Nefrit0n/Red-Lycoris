import { formatDistanceToNow } from 'date-fns';
import { ru as ruLocale } from 'date-fns/locale';

export function formatRelativeTime(date?: string | Date | null): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { locale: ruLocale, addSuffix: false });
}
