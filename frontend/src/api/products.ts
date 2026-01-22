import {
  ProductDetailDTO,
  ProductDetailView,
  ProductListItemDTO,
  ProductWithStats,
} from "../types/products";
import { ImportJobListItemDTO } from "../types/imports";
import { request, requestList, requestWithMeta } from "./client";

export const fetchProducts = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: ProductListItemDTO[]; total: number }> => {
  return requestList<ProductListItemDTO>("/api/v1/products", {
    signal,
    query: {
      limit,
      offset,
    },
  });
};

export const fetchProductsWithStats = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: ProductWithStats[]; total: number }> => {
  const productsResponse = await fetchProducts(limit, offset, signal);

  const productsWithStats: ProductWithStats[] = productsResponse.data.map((product) => ({
    ...product,
    severityBreakdown: undefined,
    trend: "flat",
    trendValue: 0,
  }));

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

  let recentScans: ProductDetailView["recentScans"];
  try {
    const scansResponse = await requestWithMeta<{ data: ImportJobListItemDTO[] }>(
      "/api/v1/import-jobs",
      {
        signal,
        query: {
          productId,
          limit: 5,
          offset: 0,
        },
      }
    );
    if (Array.isArray(scansResponse.data)) {
      recentScans = scansResponse.data.map((scan) => ({
        id: scan.id,
        scanner: scan.scanner,
        status: scan.status,
        createdAt: scan.createdAt,
        findingsNew: scan.findingsNew,
      }));
    }
  } catch {
    // ignore
  }

  return {
    ...product,
    severityBreakdown: undefined,
    recentScans,
    trend: "flat",
    trendValue: 0,
    totalScans: 0,
    findingsFixedCount: 0,
    findingsFalsePositiveCount: 0,
  };
};
