import { request, requestList } from "./client";
import { uploadFormDataWithProgress } from "./upload";

export interface SourceSnapshot {
  id: string;
  productId: string;
  size: number;
  createdAt: string;
  originalFilename?: string | null;
  label?: string | null;
  notes?: string | null;
}

export interface CreateSourceSnapshotOptions {
  idempotencyKey?: string;
  label?: string;
  notes?: string;
  onProgress?: (progress: number) => void;
}

export const createSourceSnapshot = async (
  productId: string,
  file: File,
  options?: CreateSourceSnapshotOptions
): Promise<SourceSnapshot> => {
  const formData = new FormData();
  formData.append("archive", file);
  if (options?.label) {
    formData.append("label", options.label);
  }
  if (options?.notes) {
    formData.append("notes", options.notes);
  }

  if (options?.onProgress) {
    return uploadFormDataWithProgress<SourceSnapshot>({
      url: `/api/v1/products/${productId}/source-snapshots`,
      formData,
      idempotencyKey: options.idempotencyKey,
      onProgress: options.onProgress,
    });
  }

  return request<SourceSnapshot>(`/api/v1/products/${productId}/source-snapshots`, {
    method: "POST",
    body: formData,
    json: false,
    headers: options?.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : undefined,
  });
};

export const fetchLatestSourceSnapshot = async (
  productId: string
): Promise<SourceSnapshot> => {
  return request<SourceSnapshot>(`/api/v1/products/${productId}/source-snapshots/latest`);
};

export const listSourceSnapshots = async (
  productId: string,
  limit: number,
  offset: number
): Promise<{ data: SourceSnapshot[]; total: number }> => {
  return requestList<SourceSnapshot>(`/api/v1/products/${productId}/source-snapshots`, {
    query: { limit, offset },
  });
};
