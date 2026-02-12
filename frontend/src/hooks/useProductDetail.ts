import { useCallback, useEffect, useState } from "react";
import { fetchProductDetail } from "../api/products";
import { fetchAssetContext } from "../api/assetContext";
import type { ProductDetail } from "../types/products";
import type { ProductAssetContext } from "../types/assetContext";

interface UseProductDetailResult {
  product: ProductDetail | null;
  assetContext: ProductAssetContext | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProductDetail(id: string | undefined): UseProductDetailResult {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [assetContext, setAssetContext] = useState<ProductAssetContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [productData, contextData] = await Promise.all([
          fetchProductDetail(id, signal),
          fetchAssetContext(id, signal).catch(() => null),
        ]);
        setProduct(productData);
        setAssetContext(contextData);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Failed to load product.");
        }
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { product, assetContext, loading, error, refetch };
}
