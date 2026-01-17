import {
  ApiResponse,
  BulkUpdateResponse,
  FetchFindingsParams,
  FindingDetail,
  FindingNeighbors,
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
    limit: params.limit.toString(),
    offset: params.offset.toString(),
  });

  if (params.filterProduct) {
    searchParams.set("product", params.filterProduct);
  } else if (params.filterProductId) {
    searchParams.set("productId", params.filterProductId);
  }
  if (params.filterSeverity) {
    searchParams.set("severity", params.filterSeverity);
  }
  if (params.filterStatus) {
    searchParams.set("status", params.filterStatus);
  }
  if (params.filterOccurrence) {
    searchParams.set("occurrenceStatus", params.filterOccurrence);
  }
  if (params.filterScannerType) {
    searchParams.set("scannerType", params.filterScannerType);
  }
  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.dateFrom) {
    searchParams.set("dateFrom", params.dateFrom);
  }
  if (params.dateTo) {
    searchParams.set("dateTo", params.dateTo);
  }
  if (typeof params.canonicalOnly === "boolean") {
    searchParams.set("canonicalOnly", String(params.canonicalOnly));
  }
  if (typeof params.includeRepeats === "boolean") {
    searchParams.set("includeRepeats", String(params.includeRepeats));
  }
  if (params.importJobId) {
    searchParams.set("import_job_id", params.importJobId);
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
    method: "PATCH",
    headers: getJsonHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Не удалось обновить статус");
  }

  return parseApiResponse<FindingDetail>(response);
};

export const addFindingComment = async (
  id: string,
  body: string
): Promise<void> => {
  const response = await fetch(`/api/v1/findings/${id}/comments`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    throw new Error("Не удалось добавить комментарий");
  }

  await parseApiResponse(response);
};

export const fetchFindingNeighbors = async (
  id: string,
  queryParams: string
): Promise<FindingNeighbors> => {
  const query = queryParams ? `?${queryParams}` : "";
  const response = await fetch(`/api/v1/findings/${id}/neighbors${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить соседние находки");
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
    throw new Error("Не удалось выполнить массовое действие");
  }

  return parseApiResponse<BulkUpdateResponse>(response);
};
