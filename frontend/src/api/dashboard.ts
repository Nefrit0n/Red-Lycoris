import type { DashboardData } from "../types/dashboard";
import { request } from "./client";

const API = import.meta.env.VITE_API_URL ?? "";

export const fetchDashboard = (signal?: AbortSignal): Promise<DashboardData> =>
  request<DashboardData>(`${API}/api/v1/dashboard`, { signal });
