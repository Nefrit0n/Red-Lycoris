import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/api/client";

export interface AuditEntry {
  id: string;
  request_id?: string;
  method: string;
  path: string;
  status_code: number;
  user_agent?: string;
  duration_ms: number;
  created_at: string;
  ip?: string;
  user_id?: string;
  user_email?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
}

export interface AuditFilter {
  from?: string;
  to?: string;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  q?: string;
  request_id?: string;
  limit?: string;
}

interface AuditPageResponse {
  data: AuditEntry[];
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
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    initialPageParam: undefined as string | undefined,
  });
}
