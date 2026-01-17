import { Product } from "../types/products";
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

  // parseListApiResponse сам даст нормальную ошибку на 401/403
  // но для других кодов тоже пусть будет информативно
  if (!response.ok && response.status !== 401 && response.status !== 403) {
    throw new Error(`Не удалось загрузить список продуктов (${response.status})`);
  }

  return parseListApiResponse<Product>(response);
};
