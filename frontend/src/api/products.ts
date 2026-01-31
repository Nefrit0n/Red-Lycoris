import {
  ProductDetailDTO,
  ProductDetailView,
  ProductListItemDTO,
  ProductStatsDTO,
  ProductWithStats,
} from "../types/products";
import { ImportJobListItemDTO } from "../types/imports";
import { request, requestList, requestWithMeta } from "./client";

type SeverityCounts = {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
};

type FindingsMeta = {
  severityCounts?: SeverityCounts;
};

type FindingsListEnvelope = {
  data: unknown[];
  total: number;
  meta?: FindingsMeta;
};

type ImportJobsEnvelope = {
  data: ImportJobListItemDTO[];
  total: number;
};

const normalizeSeverityBreakdown = (counts?: SeverityCounts) => {
  if (!counts) return undefined;
  return {
    critical: Number(counts.critical || 0),
    high: Number(counts.high || 0),
    medium: Number(counts.medium || 0),
    low: Number(counts.low || 0),
    info: Number(counts.info || 0),
  };
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<Array<R | null>> => {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, limit);
  const results: Array<R | null> = new Array(items.length).fill(null);

  let nextIndex = 0;
  const runNext = async (): Promise<void> => {
    const current = nextIndex;
    if (current >= items.length) return;
    nextIndex += 1;
    try {
      results[current] = await task(items[current], current);
    } catch {
      results[current] = null;
    }
    return runNext();
  };

  const runners = Array.from({ length: Math.min(safeLimit, items.length) }, () => runNext());
  await Promise.allSettled(runners);
  return results;
};

const fetchFindingsEnvelope = async (
  query: Record<string, any>,
  signal?: AbortSignal
): Promise<FindingsListEnvelope | null> => {
  try {
    const res = await requestWithMeta<FindingsListEnvelope>("/api/v1/findings", {
      signal,
      query,
    });
    if (!res || !Array.isArray(res.data)) return null;
    return res;
  } catch {
    return null;
  }
};

export const fetchProducts = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: ProductListItemDTO[]; total: number }> => {
  return requestList<ProductListItemDTO>("/api/v1/products", {
    signal,
    query: { limit, offset },
  });
};

export const fetchProductsWithStats = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: ProductWithStats[]; total: number }> => {
  const productsResponse = await fetchProducts(limit, offset, signal);

  // ⚠️ N+1 (как быстрый workaround). Правильнее — отдельный endpoint /products-with-stats.
  const findingsEnvelopes = await runWithConcurrency(
    productsResponse.data,
    4,
    async (product) =>
      fetchFindingsEnvelope(
        {
          productId: product.id,
          limit: 1,
          canonicalOnly: true,
          includeRepeats: false,
        },
        signal
      )
  );

  const productsWithStats: ProductWithStats[] = productsResponse.data.map((product, index) => {
    const env = findingsEnvelopes[index];
    const breakdown = normalizeSeverityBreakdown(env?.meta?.severityCounts);

    return {
      ...product,
      // если бэк не отдаёт findingsOpenCount в product list item (или отдаёт 0),
      // то подстрахуем total из findings
      findingsOpenCount:
        typeof env?.total === "number" ? env!.total : (product as any).findingsOpenCount ?? 0,
      severityBreakdown: breakdown,
      trend: "flat",
      trendValue: 0,
    };
  });

  return {
    data: productsWithStats,
    total: productsResponse.total,
  };
};

export const fetchProductDetail = async (
  productId: string,
  signal?: AbortSignal
): Promise<ProductDetailView> => {
  const product = await request<ProductDetailDTO>(`/api/v1/products/${productId}`, {
    signal,
  });

  // 1) Findings stats + severity breakdown (для health + графиков)
  const stats = await request<ProductStatsDTO>(`/api/v1/products/${productId}/stats`, {
    signal,
  });

  const severityBreakdown = normalizeSeverityBreakdown(stats.severityCounts);
  const findingsOpenCount =
    typeof stats.openCount === "number"
      ? stats.openCount
      : (product as any).findingsOpenCount ?? 0;

  // 2) Fixed / False positives (карточки сверху)
  // В модели бэка “исправлено” = mitigated
  const findingsFixedCount = stats.mitigatedCount || 0;
  const findingsFalsePositiveCount = stats.falsePositiveCount || 0;

  // 3) Recent scans (import jobs)
  let recentScans: ProductDetailView["recentScans"] = [];
  let totalScans = 0;

  try {
    const scansResponse = await requestWithMeta<ImportJobsEnvelope>("/api/v1/import-jobs", {
      signal,
      query: {
        productId,
        limit: 5,
        offset: 0,
      },
    });

    if (Array.isArray(scansResponse.data)) {
      recentScans = scansResponse.data.map((scan) => ({
        id: scan.id,
        scanner: scan.scanner,
        status: scan.status,
        createdAt: scan.createdAt,
        findingsNew: scan.findingsNew,
      }));
    }
    if (typeof scansResponse.total === "number") {
      totalScans = scansResponse.total;
    } else {
      totalScans = recentScans.length;
    }
  } catch {
    // ignore
  }

  // lastScanAt: если бэк не прислал — возьмём по recent scans
  const lastScanAt =
    (product as any).lastScanAt ??
    (recentScans.length > 0 ? recentScans[0].createdAt : undefined);

  return {
    ...product,
    lastScanAt,
    findingsOpenCount,
    severityBreakdown,
    recentScans,
    trend: "flat",
    trendValue: 0,
    totalScans,
    findingsFixedCount,
    findingsFalsePositiveCount,
  };
};
