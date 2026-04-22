import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/api/client";

export type AuditRiskLevel = "low" | "medium" | "high" | "critical";

export interface AuditEntry {
  id: string;
  request_id?: string;
  trace_id?: string;
  session_id?: string;
  method: string;
  path: string;
  full_path?: string;
  status_code: number;
  user_agent?: string;
  ua_parsed?: {
    browser: string;
    os: string;
    is_tor?: boolean;
    is_vpn?: boolean;
    is_datacenter?: boolean;
    country_code?: string;
  };
  duration_ms: number;
  created_at: string;
  ip?: string;
  user_id?: string;
  user_email?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  risk_level?: AuditRiskLevel;
  risk_signals?: string[];
  integrity?: {
    hash: string;
    prev_hash: string;
    verified: boolean;
  };
}

export interface AuditEntryGroup {
  kind: "group";
  count: number;
  first_timestamp: string;
  last_timestamp: string;
  sample: AuditEntry;
  events: AuditEntry[];
}

export type AuditFeedItem = AuditEntry | AuditEntryGroup;

export interface AuditStats {
  from: string;
  to: string;
  events_24h: number;
  unique_users_24h: number;
  errors_24h: number;
  critical_24h: number;
  prev_events_24h: number;
  prev_unique_users_24h: number;
  prev_errors_24h: number;
  prev_critical_24h: number;
  histogram: Array<{
    hour: string;
    total: number;
    error_count: number;
    error_ratio: number;
    success_2xx: number;
    redirect_3xx: number;
    client_4xx: number;
    server_5xx: number;
  }>;
}

export interface AuditFilter {
  from?: string;
  to?: string;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  method?: string;
  status_min?: string;
  risk_level?: string;
  ip?: string;
  trace_id?: string;
  session_id?: string;
  q?: string;
  request_id?: string;
  limit?: string;
  grouped?: string;
}

interface AuditPageResponse {
  data: AuditFeedItem[];
  meta?: {
    next_cursor?: string;
    has_more?: boolean;
    total?: number;
  };
}

export function useAuditLog(filter: AuditFilter) {
  return useInfiniteQuery({
    queryKey: ["audit-log", filter],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const params: Record<string, string> = {};
      Object.entries(filter).forEach(([k, v]) => {
        if (typeof v === "string" && v.trim() !== "") params[k] = v;
      });
      if (pageParam) params.cursor = pageParam;
      return apiGet<AuditPageResponse>("/api/v1/admin/audit", params);
    },
    getNextPageParam: (lastPage: AuditPageResponse) => lastPage.meta?.next_cursor || undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useAuditEvent(eventId?: string) {
  return useQuery({
    queryKey: ["audit-event", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const res = await apiGet<{ data: AuditEntry }>(`/api/v1/admin/audit/${eventId}`);
      return res.data;
    },
  });
}

export function useAuditDiff(eventId?: string) {
  return useQuery({
    queryKey: ["audit-diff", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const res = await apiGet<{ data: Array<{ field: string; before: unknown; after: unknown; pii?: boolean }> }>(`/api/v1/admin/audit/${eventId}/diff`);
      return res.data;
    },
  });
}

export function useRelatedAuditEvents(eventId?: string) {
  return useQuery({
    queryKey: ["audit-related", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const res = await apiGet<{ data: AuditEntry[] }>(`/api/v1/admin/audit/${eventId}/related`, { limit: "10" });
      return res.data;
    },
  });
}

export function useAuditStats(from?: string, to?: string) {
  return useQuery({
    queryKey: ["audit-stats", from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await apiGet<{ data: AuditStats }>("/api/v1/admin/audit/stats", params);
      return res.data;
    },
  });
}
