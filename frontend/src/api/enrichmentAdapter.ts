import type { FindingEnrichment } from "@/types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function pickHighestBy<T>(items: T[], selector: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, current) => {
    if (!best) return current;
    return selector(current) > selector(best) ? current : best;
  }, undefined);
}

function normalizeNvd(data: unknown): UnknownRecord {
  const parsed = safeParseJson(data);

  if (Array.isArray(parsed)) {
    const records = parsed.filter(isRecord);
    const top = pickHighestBy(records, (item) => Number(item.cvss_v31_score ?? item.cvss_v3_score ?? 0));
    if (!top) return {};

    return {
      ...top,
      cvss_v3_score: Number(top.cvss_v3_score ?? top.cvss_v31_score ?? 0) || undefined,
      cvss_v3_vector: (top.cvss_v3_vector ?? top.cvss_v31_vector) as string | undefined,
      published: (top.published ?? top.published_at) as string | undefined,
    };
  }

  if (isRecord(parsed)) {
    return {
      ...parsed,
      cvss_v3_score: Number(parsed.cvss_v3_score ?? parsed.cvss_v31_score ?? 0) || undefined,
      cvss_v3_vector: (parsed.cvss_v3_vector ?? parsed.cvss_v31_vector) as string | undefined,
      published: (parsed.published ?? parsed.published_at) as string | undefined,
    };
  }

  return {};
}

function normalizeEpss(data: unknown): UnknownRecord {
  const parsed = safeParseJson(data);

  if (Array.isArray(parsed)) {
    const records = parsed.filter(isRecord);
    const top = pickHighestBy(records, (item) => Number(item.epss_score ?? item.score ?? 0));
    if (!top) return {};

    return {
      ...top,
      score: Number(top.score ?? top.epss_score ?? 0) || undefined,
      percentile: Number(top.percentile ?? 0) || undefined,
      date: (top.date ?? top.updated_at) as string | undefined,
    };
  }

  if (isRecord(parsed)) {
    return {
      ...parsed,
      score: Number(parsed.score ?? parsed.epss_score ?? 0) || undefined,
      percentile: Number(parsed.percentile ?? 0) || undefined,
      date: (parsed.date ?? parsed.updated_at) as string | undefined,
    };
  }

  return {};
}

function normalizeKev(data: unknown): UnknownRecord {
  const parsed = safeParseJson(data);
  const item = Array.isArray(parsed) ? parsed.find(isRecord) : parsed;

  if (!isRecord(item)) return {};

  return {
    ...item,
    known_ransomware_campaign_use: item.known_ransomware_campaign_use ?? item.known_ransomware,
  };
}

function normalizePassthrough(data: unknown): UnknownRecord {
  const parsed = safeParseJson(data);
  if (Array.isArray(parsed)) {
    return (parsed.find(isRecord) ?? {}) as UnknownRecord;
  }
  return isRecord(parsed) ? parsed : {};
}

function normalizeSourceData(source: string, data: unknown): UnknownRecord {
  switch (source) {
    case "nvd":
      return normalizeNvd(data);
    case "epss":
      return normalizeEpss(data);
    case "kev":
      return normalizeKev(data);
    case "bdu":
    case "osv":
    case "cwe":
      return normalizePassthrough(data);
    default:
      return normalizePassthrough(data);
  }
}

function extractEnrichmentsPayload(payload: unknown): unknown[] {
  const parsed = safeParseJson(payload);
  if (Array.isArray(parsed)) return parsed;

  if (!isRecord(parsed)) return [];

  if (Array.isArray(parsed.data)) return parsed.data;

  if (isRecord(parsed.data) && Array.isArray(parsed.data.enrichments)) {
    return parsed.data.enrichments;
  }

  if (Array.isArray(parsed.enrichments)) return parsed.enrichments;

  return [];
}

export function normalizeEnrichmentData(payload: unknown): FindingEnrichment[] {
  const rawItems = extractEnrichmentsPayload(payload);

  const normalized = rawItems
    .filter(isRecord)
    .map((item) => {
      const source = typeof item.source === "string" ? item.source.toLowerCase() : "unknown";
      const data = normalizeSourceData(source, item.data);

      return {
        finding_id: String(item.finding_id ?? ""),
        source,
        data,
        enriched_at: String(item.enriched_at ?? ""),
      } as FindingEnrichment;
    })
    .filter((item) => item.source !== "unknown");

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[enrichment] normalized payload", {
      inputType: typeof payload,
      total: normalized.length,
      sources: normalized.map((entry) => entry.source),
      sample: normalized[0],
    });
  }

  return normalized;
}
