import { ImportJob, ImportJobDetail } from "../types/imports";
import { getAuthHeaders, parseApiResponse, parseApiResponseWithMeta } from "./httpClient";

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
  const searchParams = new URLSearchParams({
    limit: params.limit.toString(),
    offset: params.offset.toString(),
  });
  if (params.productId) {
    searchParams.set("productId", params.productId);
  }
  if (params.scanner) {
    searchParams.set("scanner", params.scanner);
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }

  const response = await fetch(`/api/v1/import-jobs?${searchParams}`, {
    method: "GET",
    headers: getAuthHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить список импортов");
  }

  const payload = await parseApiResponseWithMeta<{
    data: ImportJob[];
    total: number;
  }>(response);

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    total: typeof payload.total === "number" ? payload.total : 0,
  };
};

export const fetchImportJobDetail = async (
  id: string,
  signal?: AbortSignal
): Promise<ImportJobDetail> => {
  const response = await fetch(`/api/v1/import-jobs/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить детали импорта");
  }

  return parseApiResponse<ImportJobDetail>(response);
};
