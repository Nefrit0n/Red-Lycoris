// Shared severity metadata so chips, row accents and summaries all speak the
// same visual language. Keys mirror the numeric enum the backend emits.

export const SEVERITY_LEVELS = [0, 1, 2, 3, 4] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export interface SeverityMeta {
  label: string;
  short: string;
  // Tailwind class pair used on outlined chips (background + border + text).
  badgeClass: string;
  // Solid fill used for bar charts, accent stripes, etc.
  fillClass: string;
  // Left-border stripe for list rows.
  borderClass: string;
  // Sort order weight — critical should sort highest when desc.
  weight: number;
}

export const SEVERITY_META: Record<number, SeverityMeta> = {
  0: {
    label: "Инфо",
    short: "Info",
    badgeClass: "border-zinc-600 bg-zinc-800/60 text-zinc-400",
    fillClass: "bg-zinc-500",
    borderClass: "border-l-zinc-500",
    weight: 0,
  },
  1: {
    label: "Низкая",
    short: "Low",
    badgeClass: "border-blue-700/50 bg-blue-950/50 text-blue-400",
    fillClass: "bg-blue-500",
    borderClass: "border-l-blue-500",
    weight: 1,
  },
  2: {
    label: "Средняя",
    short: "Med",
    badgeClass: "border-yellow-700/50 bg-yellow-950/40 text-yellow-400",
    fillClass: "bg-yellow-500",
    borderClass: "border-l-yellow-500",
    weight: 2,
  },
  3: {
    label: "Высокая",
    short: "High",
    badgeClass: "border-orange-700/50 bg-orange-950/40 text-orange-400",
    fillClass: "bg-orange-500",
    borderClass: "border-l-orange-500",
    weight: 3,
  },
  4: {
    label: "Критическая",
    short: "Crit",
    badgeClass: "border-red-700/50 bg-red-950/40 text-red-400",
    fillClass: "bg-red-500",
    borderClass: "border-l-red-500",
    weight: 4,
  },
};

export function severityMeta(level: number): SeverityMeta {
  return SEVERITY_META[level] ?? SEVERITY_META[0];
}

// Lookup used by URL (de)serialization — accepts either the numeric form or
// the short English slug.
export function parseSeverity(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 0 && n <= 4) {
    return n;
  }
  switch (trimmed) {
    case "info":
      return 0;
    case "low":
      return 1;
    case "med":
    case "medium":
      return 2;
    case "high":
      return 3;
    case "crit":
    case "critical":
      return 4;
    default:
      return null;
  }
}

// Status metadata lives alongside severity because triage chips render both
// in the same row of filters.
export const STATUS_META: Record<
  number,
  { label: string; badgeClass: string }
> = {
  0: {
    label: "Открыто",
    badgeClass: "border-sky-700/50 bg-sky-950/40 text-sky-300",
  },
  1: {
    label: "Подтверждено",
    badgeClass: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  },
  2: {
    label: "Ложное",
    badgeClass: "border-zinc-600 bg-zinc-800/60 text-zinc-400",
  },
  3: {
    label: "Исправлено",
    badgeClass: "border-green-700/50 bg-green-950/40 text-green-300",
  },
  4: {
    label: "Принят риск",
    badgeClass: "border-amber-700/50 bg-amber-950/40 text-amber-300",
  },
};

export function statusMeta(status: number) {
  return STATUS_META[status] ?? STATUS_META[0];
}
