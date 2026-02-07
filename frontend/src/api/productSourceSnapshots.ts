import { request, requestList } from "./client";
import { uploadFormDataWithProgress } from "./upload";

export interface ProductSourceSnapshot {
  id: string;
  productId: string;
  size: number;
  createdAt: string;
}

export const createProductSourceSnapshot = async (
  productId: string,
  file: File,
  options?: { idempotencyKey?: string; onProgress?: (progress: number) => void }
): Promise<ProductSourceSnapshot> => {
  const formData = new FormData();
  formData.append("archive", file);

  if (options?.onProgress) {
    return uploadFormDataWithProgress<ProductSourceSnapshot>({
      url: `/api/v1/products/${productId}/source-snapshots`,
      formData,
      idempotencyKey: options.idempotencyKey,
      onProgress: options.onProgress,
    });
  }

  return request<ProductSourceSnapshot>(`/api/v1/products/${productId}/source-snapshots`, {
    method: "POST",
    body: formData,
    json: false,
    headers: options?.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : undefined,
  });
};

export const fetchLatestProductSourceSnapshot = async (
  productId: string
): Promise<ProductSourceSnapshot> => {
  return request<ProductSourceSnapshot>(`/api/v1/products/${productId}/source-snapshots/latest`);
};

export const listProductSourceSnapshots = async (
  productId: string,
  limit: number,
  offset: number
): Promise<{ data: ProductSourceSnapshot[]; total: number }> => {
  return requestList<ProductSourceSnapshot>(`/api/v1/products/${productId}/source-snapshots`, {
    query: { limit, offset },
  });
};
