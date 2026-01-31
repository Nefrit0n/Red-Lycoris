export type NormalizedSeverityCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

const SEVERITY_KEYS = ["critical", "high", "medium", "low", "info"] as const;

export const normalizeSeverityCounts = (
  input?: Record<string, unknown> | null
): NormalizedSeverityCounts => {
  const normalized: NormalizedSeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  if (!input) return normalized;

  Object.entries(input).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (!SEVERITY_KEYS.includes(normalizedKey as (typeof SEVERITY_KEYS)[number])) return;
    const numeric = Number(value);
    normalized[normalizedKey as keyof NormalizedSeverityCounts] = Number.isFinite(numeric)
      ? numeric
      : 0;
  });

  return normalized;
};
