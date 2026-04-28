const H = 60 * 60 * 1000;
export function cronToMs(cron: string): number {
  if (cron.includes('*/1')) return H;
  if (cron.includes('*/2')) return 2 * H;
  if (cron.includes('*/6')) return 6 * H;
  if (cron.includes('*/7') || cron.includes('*/7')) return 7 * 24 * H;
  return 24 * H;
}
