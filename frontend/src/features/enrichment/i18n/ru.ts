export const ru = {
  breadcrumb: 'Обогащение',
  title: 'Состояние источников',
  autoUpdate: (sec: number) => `авто-обновление · ${sec} с`,
  filters: 'Фильтры',
  syncStale: (n: number) => `Синхронизировать устаревшие · ${n}`,
  kpi: {
    totalRecords: 'Всего записей',
    health: 'Здоровье',
    running: 'В работе',
    attention: 'Требуют внимания',
    perDay: (n: number) => `↑ ${n.toLocaleString('ru-RU')} / 24 ч`,
  },
  timeline: { title: 'Активность · последние 2 часа', running: 'идёт', failed: 'ошибка' },
  chips: { all: 'Все', success: 'Успешно', running: 'В работе', error: 'Ошибки', stale: 'Устарели' },
  card: {
    records: 'записей', sync: '⟳ Синк', history: 'История', logs: 'Логи', abort: '⏸ Прервать',
    runNow: '⟳ Запустить сейчас', retry: '⟳ Повторить', nextIn: (rel: string) => `→ ${rel}`,
    schedule: (rel: string) => `по графику ${rel}`, lastSuccess: (rel: string) => `последний успех ${rel}`,
    deltaStable: '↔ 0', deltaNoData: '— нет данных',
  },
  error: {
    retryAttempt: (cur: number, max: number) => `retry ${cur}/${max}`,
    nextAttempt: (rel: string) => `следующая попытка через ${rel}`,
  },
  sortBy: 'сортировка:',
  sortOptions: { records: 'по записям', lastSync: 'по последнему синку', name: 'по имени', health: 'по здоровью' },
} as const;
