import { Product } from "../types/products";
import { getAuthHeaders, parseApiResponseWithMeta } from "./http";

export const fetchProducts = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: Product[]; total: number }> => {
  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`/api/v1/products?${searchParams}`, {
    method: "GET",
    headers: getAuthHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить список продуктов");
  }

  const payload = await parseApiResponseWithMeta<{
    data: Product[];
    total: number;
  }>(response);

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    total: typeof payload.total === "number" ? payload.total : 0,
  };
};
