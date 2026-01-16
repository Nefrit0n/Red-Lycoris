import {
  ApiResponse,
  FetchFindingsParams,
  FindingDetail,
  FindingStatus,
} from "../types/findings";
import {
  getAuthHeaders,
  getJsonHeaders,
  parseApiResponse,
  parseApiResponseWithMeta,
} from "./http";

export const fetchFindings = async (
  params: FetchFindingsParams,
  signal?: AbortSignal
): Promise<ApiResponse> => {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });

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

  const response = await fetch(`/api/v1/findings?${searchParams}`, {
    method: "GET",
    signal,
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить список находок");
  }

  const payload = await parseApiResponseWithMeta<{
    data: ApiResponse["data"];
    total: number;
  }>(response);

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    total: typeof payload.total === "number" ? payload.total : 0,
  };
};

export const fetchFindingDetail = async (
  id: string,
  signal?: AbortSignal
): Promise<FindingDetail> => {
  const response = await fetch(`/api/v1/findings/${id}`, {
    method: "GET",
    signal,
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить детали уязвимости");
  }

  return parseApiResponse<FindingDetail>(response);
};

export const updateFindingStatus = async (
  id: string,
  status: FindingStatus
): Promise<FindingDetail> => {
  const response = await fetch(`/api/v1/findings/${id}`, {
    method: "PUT",
    headers: getJsonHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Не удалось обновить статус");
  }

  return parseApiResponse<FindingDetail>(response);
};
