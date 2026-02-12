import type { ProductAssetContext } from "../types/assetContext";
import { request } from "./client";
import { ApiError } from "./http";

export const fetchAssetContext = async (
  productId: string,
  signal?: AbortSignal,
): Promise<ProductAssetContext | null> => {
  try {
    return await request<ProductAssetContext>(
      `/api/v1/products/${productId}/asset-context`,
      { signal },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
};
