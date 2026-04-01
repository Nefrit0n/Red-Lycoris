import type { DashboardData } from "../types/dashboard";
import { request } from "./client";

const DASHBOARD_ENDPOINT = "/api/v1/dashboard";
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

const resolveDashboardUrl = (): string => {
  if (!API_BASE) return DASHBOARD_ENDPOINT;

  if (API_BASE.endsWith("/api/v1")) {
    return `${API_BASE}/dashboard`;
  }

  if (API_BASE.endsWith("/api")) {
    return `${API_BASE}/v1/dashboard`;
  }

  return `${API_BASE}${DASHBOARD_ENDPOINT}`;
};

export const fetchDashboard = (signal?: AbortSignal): Promise<DashboardData> =>
  request<DashboardData>(resolveDashboardUrl(), { signal });
