import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/api/client";
import type { Finding, PaginatedResponse } from "@/types";

interface FindingsFilters {
  severities?: number[];
  statuses?: number[];
  query?: string;
  projectId?: string | null;
  sortField?: string;
  sortDir?: "asc" | "desc";
  cursor?: string | null;
  limit?: number;
}

function buildParams(f: FindingsFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.severities?.length) {
    p.severity = f.severities.join(",");
  }
  if (f.statuses?.length) {
    p.status = f.statuses.join(",");
  }
  if (f.query) {
    p.q = f.query;
  }
  if (f.projectId) {
    p.project_id = f.projectId;
  }
  if (f.sortField) {
    const prefix = f.sortDir === "desc" ? "-" : "";
    p.sort = `${prefix}${f.sortField}`;
  }
  if (f.cursor) {
    p.cursor = f.cursor;
  }
  p.limit = String(f.limit ?? 50);
  return p;
}

export function useFindings(filters: FindingsFilters) {
  return useInfiniteQuery({
    queryKey: ["findings", filters] as const,
    queryFn: ({ pageParam }) => {
      const params = buildParams({ ...filters, cursor: pageParam as string | undefined });
      return apiGet<PaginatedResponse<Finding[]>>("/api/v1/findings", params);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.meta.has_more ? (last.meta.next_cursor ?? undefined) : undefined,
  });
}

export function useFinding(id: string) {
  return useQuery({
    queryKey: ["finding", id],
    queryFn: () => apiGet<{ data: Finding }>(`/api/v1/findings/${id}`),
    enabled: !!id,
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      apiPatch<{ data: Finding }>(`/api/v1/findings/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings"] });
    },
  });
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: number }) =>
      apiPatch<{ data: { updated: number } }>("/api/v1/findings/bulk", {
        ids,
        status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings"] });
    },
  });
}
