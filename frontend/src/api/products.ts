import { Product, ProductWithStats, ProductDetail } from "../types/products";
import { getAuthHeaders, parseListApiResponse } from "./http";

export const fetchProducts = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: Product[]; total: number }> => {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await fetch(`/api/v1/products?${searchParams.toString()}`, {
    method: "GET",
    headers: getAuthHeaders(),
    signal,
  });

  if (!response.ok && response.status !== 401 && response.status !== 403) {
    throw new Error(`Не удалось загрузить список продуктов (${response.status})`);
  }

  return parseListApiResponse<Product>(response);
};

export const fetchProductsWithStats = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: ProductWithStats[]; total: number }> => {
  // Fetch base products
  const productsResponse = await fetchProducts(limit, offset, signal);

  // For each product, fetch stats (we'll mock severity breakdown for now)
  // In production, this would be a separate API endpoint or included in the products response
  const productsWithStats: ProductWithStats[] = await Promise.all(
    productsResponse.data.map(async (product) => {
      try {
        // Try to fetch findings stats for this product
        const statsResponse = await fetch(
          `/api/v1/findings?productId=${product.id}&limit=1`,
          {
            method: "GET",
            headers: getAuthHeaders(),
            signal,
          }
        );

        if (statsResponse.ok) {
          const statsJson = await statsResponse.json();
          const severityCounts = statsJson.meta?.severityCounts;

          if (severityCounts) {
            return {
              ...product,
              severityBreakdown: {
                critical: severityCounts.critical || 0,
                high: severityCounts.high || 0,
                medium: severityCounts.medium || 0,
                low: severityCounts.low || 0,
                info: severityCounts.info || 0,
              },
              trend: "flat" as const,
              trendValue: 0,
            };
          }
        }
      } catch {
        // Ignore errors and return product without stats
      }

      return {
        ...product,
        severityBreakdown: undefined,
        trend: "flat" as const,
        trendValue: 0,
      };
    })
  );

  return {
    data: productsWithStats,
    total: productsResponse.total,
  };
};

export const fetchProductDetail = async (
  productId: string,
  signal?: AbortSignal
): Promise<ProductDetail> => {
  const response = await fetch(`/api/v1/products/${productId}`, {
    method: "GET",
    headers: getAuthHeaders(),
    signal,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Продукт не найден");
    }
    throw new Error(`Не удалось загрузить продукт (${response.status})`);
  }

  const product = await response.json();

  // Fetch findings stats for this product
  let severityBreakdown;
  try {
    const statsResponse = await fetch(
      `/api/v1/findings?productId=${productId}&limit=1`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        signal,
      }
    );

    if (statsResponse.ok) {
      const statsJson = await statsResponse.json();
      const severityCounts = statsJson.meta?.severityCounts;
      if (severityCounts) {
        severityBreakdown = {
          critical: severityCounts.critical || 0,
          high: severityCounts.high || 0,
          medium: severityCounts.medium || 0,
          low: severityCounts.low || 0,
          info: severityCounts.info || 0,
        };
      }
    }
  } catch {
    // Ignore
  }

  // Fetch recent scans (import jobs) for this product
  let recentScans;
  try {
    const scansResponse = await fetch(
      `/api/v1/import-jobs?productId=${productId}&limit=5`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        signal,
      }
    );

    if (scansResponse.ok) {
      const scansJson = await scansResponse.json();
      recentScans = scansJson.data?.map((scan: any) => ({
        id: scan.id,
        scannerType: scan.scannerType || "unknown",
        status: scan.status || "unknown",
        createdAt: scan.createdAt,
        findingsCount: scan.findingsCount || 0,
      }));
    }
  } catch {
    // Ignore
  }

  return {
    ...product,
    severityBreakdown,
    recentScans,
    trend: "flat" as const,
    trendValue: 0,
    totalScans: 0,
    findingsFixedCount: 0,
    findingsFalsePositiveCount: 0,
  };
};
