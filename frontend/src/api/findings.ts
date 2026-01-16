import {
  ApiResponse,
  FetchFindingsParams,
  FindingDetail,
  FindingStatus,
} from "../types/findings";
import { getAuthHeaders, parseApiResponse } from "./http";

export const fetchFindings = async (
  params: FetchFindingsParams,
  signal?: AbortSignal
): Promise<ApiResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  searchParams.set("pageSize", params.pageSize.toString());

  if (params.filterProductId) {
    searchParams.set("productId", params.filterProductId);
  }
  if (params.filterSeverity) {
    searchParams.set("severity", params.filterSeverity);
  }
  if (params.filterStatus) {
    searchParams.set("status", params.filterStatus);
  }
  if (params.sortField) {
    searchParams.set("sortField", params.sortField);
  }
  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }

  const response = await fetch(`/api/v1/findings?${searchParams.toString()}`, {
    method: "GET",
    signal,
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить список находок");
  }

  const payload = await parseApiResponse<{ data: ApiResponse["data"]; total: number }>(response);
  return { data: payload.data, total: payload.total };
};

export const fetchFindingDetail = async (
  id: string,
  signal?: AbortSignal
): Promise<FindingDetail> => {
  const response = await fetch(`/api/v1/findings/${id}`, {
    method: "GET",
    signal,
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить детали уязвимости");
  }

  const payload = await parseApiResponse<{ data: FindingDetail }>(response);
  return payload.data;
};

export const updateFindingStatus = async (
  id: string,
  status: FindingStatus
): Promise<FindingDetail> => {
  const response = await fetch(`/api/v1/findings/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Не удалось обновить статус");
  }

  const payload = await parseApiResponse<{ data: FindingDetail }>(response);
  return payload.data;
};
