import {
  ApiResponse,
  BulkUpdateResponse,
  FetchFindingsParams,
  Finding,
  FindingDetail,
  FindingNeighbors,
  FindingStatus,
} from "../types/findings";
import {
  getAuthHeaders,
  getJsonHeaders,
  parseApiResponse,
  parseListApiResponse,
} from "./http";

export const fetchFindings = async (
  params: FetchFindingsParams,
  signal?: AbortSignal
): Promise<ApiResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit));
  searchParams.set("offset", String(params.offset));

  // product filter (держим оба ключа для совместимости, но отправляем только один)
  if (params.filterProduct) {
    searchParams.set("product", params.filterProduct);
  } else if (params.filterProductId) {
    searchParams.set("productId", params.filterProductId);
  }

  if (params.filterSeverity) searchParams.set("severity", params.filterSeverity);
  if (params.filterStatus) searchParams.set("status", params.filterStatus);
  if (params.filterOccurrence) searchParams.set("occurrenceStatus", params.filterOccurrence);
  if (params.filterScannerType) searchParams.set("scannerType", params.filterScannerType);

  if (params.search) searchParams.set("search", params.search);

  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);

  if (typeof params.canonicalOnly === "boolean") {
    searchParams.set("canonicalOnly", String(params.canonicalOnly));
  }
  if (typeof params.includeRepeats === "boolean") {
    searchParams.set("includeRepeats", String(params.includeRepeats));
  }

  if (params.importJobId) searchParams.set("import_job_id", params.importJobId);
  if (params.sortField) searchParams.set("sortField", String(params.sortField));
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const response = await fetch(`/api/v1/findings?${searchParams.toString()}`, {
    method: "GET",
    signal,
    headers: getAuthHeaders(),
  });

  // parseListApiResponse сам:
  // - корректно распарсит data/items/success.data и т.п.
  // - кинет нормальную ошибку на 401/403
  return parseListApiResponse<Finding>(response);
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
    throw new Error(`Не удалось загрузить детали уязвимости (${response.status})`);
  }

  return parseApiResponse<FindingDetail>(response);
};

export const updateFindingStatus = async (
  id: string,
  status: FindingStatus,
  signal?: AbortSignal
): Promise<FindingDetail> => {
  const response = await fetch(`/api/v1/findings/${id}`, {
    method: "PATCH",
    signal,
    headers: getJsonHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(`Не удалось обновить статус (${response.status})`);
  }

  return parseApiResponse<FindingDetail>(response);
};

export const addFindingComment = async (
  id: string,
  body: string,
  signal?: AbortSignal
): Promise<void> => {
  const response = await fetch(`/api/v1/findings/${id}/comments`, {
    method: "POST",
    signal,
    headers: getJsonHeaders(),
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    throw new Error(`Не удалось добавить комментарий (${response.status})`);
  }

  await parseApiResponse(response);
};

export const fetchFindingNeighbors = async (
  id: string,
  queryParams: string,
  signal?: AbortSignal
): Promise<FindingNeighbors> => {
  const query = queryParams ? `?${queryParams}` : "";
  const response = await fetch(`/api/v1/findings/${id}/neighbors${query}`, {
    method: "GET",
    signal,
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить соседние находки (${response.status})`);
  }

  return parseApiResponse<FindingNeighbors>(response);
};

export const bulkUpdateFindings = async (payload: {
  ids: string[];
  select_all?: boolean;
  filters?: {
    product?: string;
    severity?: string;
    status?: string;
    occurrenceStatus?: string;
    scannerType?: string;
    q?: string;
    import_job_id?: string;
    dateFrom?: string;
    dateTo?: string;
    canonicalOnly?: boolean;
    includeRepeats?: boolean;
  };
  action: "set_status" | "assign" | "dismiss";
  payload: Record<string, unknown>;
}): Promise<BulkUpdateResponse> => {
  const response = await fetch("/api/v1/findings/bulk", {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Не удалось выполнить массовое действие (${response.status})`);
  }

  return parseApiResponse<BulkUpdateResponse>(response);
};
