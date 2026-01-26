import {
  DashboardData,
  RiskMetricsDTO,
} from "../types/dashboard";
import { request } from "./client";

/**
 * Fetch all dashboard data from backend
 * Backend performs all aggregations server-side for accurate results
 */
export const fetchDashboardData = async (signal?: AbortSignal): Promise<DashboardData> => {
  const response = await request<DashboardData>("/api/v1/dashboard", { signal });
  return {
    ...response,
    riskMetrics: null, // Risk metrics are fetched separately
  };
};

export const fetchRiskMetrics = async (
  params: {
    productId?: string;
    from?: string;
    to?: string;
    status?: string;
  },
  signal?: AbortSignal
): Promise<RiskMetricsDTO> => {
  const searchParams = new URLSearchParams();
  if (params.productId) searchParams.set("productId", params.productId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.status) searchParams.set("status", params.status);

  return request<RiskMetricsDTO>("/api/v1/metrics/risk", {
    signal,
    query: searchParams,
  });
};
