import {
  BulkUpdateResponse,
  FetchFindingsParams,
  FindingListItemDTO,
  FindingDetailDTO,
  FindingNeighbors,
  FindingStatus,
  FindingsListResponse,
} from "../types/findings";
import { request, requestWithMeta } from "./client";

export const fetchFindings = async (
  params: FetchFindingsParams,
  signal?: AbortSignal
): Promise<FindingsListResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit));
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  } else if (typeof params.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }
  if (params.includeMeta) searchParams.set("includeMeta", "true");

  // product filter (productId основной, product оставляем для совместимости)
  if (params.filterProductId) {
    searchParams.set("productId", params.filterProductId);
  } else if (params.filterProduct) {
    searchParams.set("product", params.filterProduct);
  }

  if (params.filterSeverity) searchParams.set("severity", params.filterSeverity);
  if (params.filterStatus) searchParams.set("status", params.filterStatus);
  if (params.filterRiskBand) searchParams.set("riskBand", params.filterRiskBand);
  if (params.filterOccurrence) searchParams.set("occurrenceStatus", params.filterOccurrence);
  if (params.filterScannerType) searchParams.set("scannerType", params.filterScannerType);
  if (params.filterPolicyDecision) {
    searchParams.set("policyDecision", params.filterPolicyDecision);
  }

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

  const response = await requestWithMeta<{
    success?: boolean;
    data?: FindingListItemDTO[];
    total?: number;
    nextCursor?: string;
    meta?: { severityCounts?: Record<string, number>; statusCounts?: Record<string, number> };
  }>("/api/v1/findings", {
    signal,
    query: searchParams,
  });

  return {
    data: Array.isArray(response?.data) ? response.data : [],
    total: typeof response?.total === "number" ? response.total : undefined,
    nextCursor: response?.nextCursor,
    meta: response?.meta,
  };
};

export const fetchFindingDetail = async (
  id: string,
  signal?: AbortSignal,
  options?: { includeRiskFactors?: boolean }
): Promise<FindingDetailDTO> => {
  const searchParams = new URLSearchParams();
  if (options?.includeRiskFactors) {
    searchParams.set("includeRiskFactors", "true");
  }
  return request<FindingDetailDTO>(`/api/v1/findings/${id}`, {
    signal,
    query: searchParams,
  });
};

export const updateFindingStatus = async (
  id: string,
  status: FindingStatus,
  signal?: AbortSignal
): Promise<FindingDetailDTO> => {
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
    policyDecision?: string;
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
