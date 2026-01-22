import { ImportJob, ImportJobDetail } from "../types/imports";
import { request, requestWithMeta } from "./client";

export const fetchImportJobs = async (
  params: {
    limit: number;
    offset: number;
    productId?: string;
    scanner?: string;
    status?: string;
  },
  signal?: AbortSignal
): Promise<{ data: ImportJob[]; total: number }> => {
  const payload = await requestWithMeta<{
    data: ImportJob[];
    total: number;
  }>("/api/v1/import-jobs", {
    signal,
    query: {
      limit: params.limit,
      offset: params.offset,
      productId: params.productId,
      scanner: params.scanner,
      status: params.status,
    },
  });

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    total: typeof payload.total === "number" ? payload.total : 0,
  };
};

export const fetchImportJobDetail = async (
  id: string,
  signal?: AbortSignal
): Promise<ImportJobDetail> => {
  return request<ImportJobDetail>(`/api/v1/import-jobs/${id}`, { signal });
};
