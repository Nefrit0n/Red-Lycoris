import {
  ApiResponse,
  BulkUpdateResponse,
  FetchFindingsParams,
  FindingListItemDTO,
  FindingDetailDTO,
  FindingNeighbors,
  FindingStatus,
} from "../types/findings";
import { request, requestList } from "./client";

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

  return requestList<FindingListItemDTO>("/api/v1/findings", {
    signal,
    query: searchParams,
  });
};

export const fetchFindingDetail = async (
  id: string,
  signal?: AbortSignal
): Promise<FindingDetail> => {
  return request<FindingDetailDTO>(`/api/v1/findings/${id}`, { signal });
};

export const updateFindingStatus = async (
  id: string,
  status: FindingStatus,
  signal?: AbortSignal
): Promise<FindingDetail> => {
  return request<FindingDetailDTO>(`/api/v1/findings/${id}`, {
    method: "PATCH",
    signal,
    body: { status },
    json: true,
  });
};

export const addFindingComment = async (
  id: string,
  body: string,
  signal?: AbortSignal
): Promise<void> => {
  await request<void>(`/api/v1/findings/${id}/comments`, {
    method: "POST",
    signal,
    body: { body },
    json: true,
  });
};

export const fetchFindingNeighbors = async (
  id: string,
  queryParams: string,
  signal?: AbortSignal
): Promise<FindingNeighbors> => {
  return request<FindingNeighbors>(`/api/v1/findings/${id}/neighbors`, {
    signal,
    query: queryParams ? new URLSearchParams(queryParams) : undefined,
  });
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
  return request<BulkUpdateResponse>("/api/v1/findings/bulk", {
    method: "POST",
    body: payload,
    json: true,
  });
};
