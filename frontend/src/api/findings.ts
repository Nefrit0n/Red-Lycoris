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
  searchParams.set("offset", String(params.offset ?? 0));
  if (params.includeMeta) searchParams.set("includeMeta", "true");

  // product filter (productId основной, product оставляем для совместимости)
  const appendArrayParam = (key: string, values?: string[]) => {
    values?.forEach((value) => {
      if (value) {
        searchParams.append(key, value);
      }
    });
  };

  if (params.filterProductId?.length) {
    appendArrayParam("productId", params.filterProductId);
  } else if (params.filterProduct?.length) {
    appendArrayParam("product", params.filterProduct);
  }

  appendArrayParam("severity", params.filterSeverity);
  appendArrayParam("status", params.filterStatus);
  appendArrayParam("riskBand", params.filterRiskBand);
  appendArrayParam("occurrenceStatus", params.filterOccurrence);
  appendArrayParam("scannerType", params.filterScannerType);
  appendArrayParam("policyDecision", params.filterPolicyDecision);
  appendArrayParam("category", params.filterCategory);

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
    nextCursor?: string;
    meta?: {
      hasNext?: boolean;
      total?: number;
      severityCounts?: Record<string, number>;
      statusCounts?: Record<string, number>;
    };
  }>("/api/v1/findings", {
    signal,
    query: searchParams,
  });

  const meta = response?.meta ?? undefined;
  return {
    data: Array.isArray(response?.data) ? response.data : [],
    total: typeof meta?.total === "number" ? meta.total : undefined,
    meta,
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
    product?: string | string[];
    severity?: string | string[];
    status?: string | string[];
    occurrenceStatus?: string | string[];
    scannerType?: string | string[];
    policyDecision?: string | string[];
    riskBand?: string | string[];
    category?: string | string[];
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
