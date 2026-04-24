import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/api/client";
import {
  buildQueryString,
  filterCacheKey,
  type FindingsFilter as FindingsFilterV2,
} from "@/lib/findings-filter";
import type {
  Finding,
  FindingEvent,
  FindingEnrichment,
  FindingGroup,
  FindingScore,
  FindingsFacets,
  PaginatedResponse,
} from "@/types";

type SortDir = "asc" | "desc";

export interface FindingsFilters {
  severities?: number[];
  statuses?: number[];
  query?: string;
  projectId?: string | null;
  sortField?: string;
  sortDir?: SortDir;
  limit?: number;
}

type FindingsPage = PaginatedResponse<Finding[]>;

export interface FindingDetailPayload {
  finding: Finding;
  enrichments?: FindingEnrichment[];
  score?: FindingScore;
  seen_in_scans?: Array<{
    id: string;
    branch: string;
    commit_sha: string;
    scanner: string;
    started_at: string;
    ci_job_url?: string | null;
  }>;
}

export interface FindingDetailResponse {
  data: FindingDetailPayload;
}

export interface TriageRequest {
  action: "change_status" | "close" | "reopen" | "assign" | "unassign";
  status?: number;
  reason_code?: string;
  note?: string;
  to_user_id?: string;
  to_email?: string;
}

export interface ClosureReason {
  id: number;
  code: string;
  label: string;
  target_status: number;
  requires_note: boolean;
  is_active: boolean;
}

export interface AssignableUser {
  id: string;
  email: string;
  full_name: string;
}

interface NormalizedFindingsFilters {
  severities: number[];
  statuses: number[];
  query: string;
  projectId: string | null;
  sortField: string;
  sortDir: SortDir;
  limit: number;
}

const findingsKeys = {
  all: ["findings"] as const,
  list: (filters: NormalizedFindingsFilters) =>
    [
      ...findingsKeys.all,
      filters.severities.join(","),
      filters.statuses.join(","),
      filters.query,
      filters.projectId ?? "",
      filters.sortField,
      filters.sortDir,
      filters.limit,
    ] as const,
};

const findingKeys = {
  all: ["finding"] as const,
  detail: (id: string) => [...findingKeys.all, id] as const,
};

function normalizeFilters(filters: FindingsFilters): NormalizedFindingsFilters {
  return {
    severities: [...(filters.severities ?? [])].sort((a, b) => a - b),
    statuses: [...(filters.statuses ?? [])].sort((a, b) => a - b),
    query: filters.query?.trim() ?? "",
    projectId: filters.projectId ?? null,
    sortField: filters.sortField?.trim() ?? "",
    sortDir: filters.sortDir ?? "desc",
    limit: filters.limit ?? 50,
  };
}

function buildParams(
  filters: NormalizedFindingsFilters,
  cursor?: string | null,
): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.severities.length > 0) {
    params.severity = filters.severities.join(",");
  }

  if (filters.statuses.length > 0) {
    params.status = filters.statuses.join(",");
  }

  if (filters.query) {
    params.q = filters.query;
  }

  if (filters.projectId) {
    params.project_id = filters.projectId;
  }

  if (filters.sortField) {
    const prefix = filters.sortDir === "desc" ? "-" : "";
    params.sort = `${prefix}${filters.sortField}`;
  }

  if (cursor) {
    params.cursor = cursor;
  }

  params.limit = String(filters.limit);

  return params;
}

function patchFindingStatusesInListCache(
  qc: QueryClient,
  ids: string[],
  status: number,
) {
  const idSet = new Set(ids);

  qc.setQueriesData<InfiniteData<FindingsPage>>(
    { queryKey: findingsKeys.all },
    (old) => {
      if (!old) return old;
      if (!("pages" in old) || !Array.isArray(old.pages)) {
        return old;
      }

      let changed = false;

      const pages = old.pages.map((page) => {
        if (!page || !Array.isArray(page.data)) {
          return page;
        }
        let pageChanged = false;

        const data = page.data.map((finding) => {
          if (!idSet.has(finding.id) || finding.status === status) {
            return finding;
          }

          changed = true;
          pageChanged = true;

          return {
            ...finding,
            status,
          };
        });

        return pageChanged ? { ...page, data } : page;
      });

      return changed ? { ...old, pages } : old;
    },
  );
}

function patchFindingStatusesInDetailCache(
  qc: QueryClient,
  ids: string[],
  status: number,
) {
  for (const id of ids) {
    qc.setQueryData<FindingDetailResponse>(findingKeys.detail(id), (old) => {
      if (!old || old.data.finding.status === status) {
        return old;
      }

      return {
        ...old,
        data: {
          ...old.data,
          finding: {
            ...old.data.finding,
            status,
          },
        },
      };
    });
  }
}

export function useFindings(filters: FindingsFilters) {
  const normalized = normalizeFilters(filters);

  return useInfiniteQuery({
    queryKey: findingsKeys.list(normalized),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiGet<FindingsPage>(
        "/api/v1/findings",
        buildParams(normalized, pageParam),
      ),
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta.has_more) {
        return null;
      }

      return lastPage.meta.next_cursor ?? null;
    },
    staleTime: 30_000,
  });
}

// ---------- v2 hooks backed by FindingsFilter from lib/findings-filter.ts ---
//
// useFindings (above) is the legacy hook tied to the zustand store. The v2
// hooks take a URL-driven FindingsFilter and are what the redesigned
// FindingsList page consumes.

const LIST_PAGE_LIMIT = 50;

type FindingsListPage = PaginatedResponse<Finding[]>;
type FindingsGroupsPage = PaginatedResponse<FindingGroup[]>;
type FindingsFacetsResponse = { data: FindingsFacets };

export const findingsListKeys = {
  all: ["findings", "v2"] as const,
  list: (filter: FindingsFilterV2) =>
    [...findingsListKeys.all, "list", filterCacheKey(filter)] as const,
  groups: (filter: FindingsFilterV2) =>
    [...findingsListKeys.all, "groups", filterCacheKey(filter)] as const,
  facets: (filter: FindingsFilterV2) =>
    [...findingsListKeys.all, "facets", filterCacheKey(filter)] as const,
};

export function useFindingsList(filter: FindingsFilterV2) {
  return useInfiniteQuery({
    queryKey: findingsListKeys.list(filter),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiGet<FindingsListPage>(
        "/api/v1/findings",
        buildQueryString(filter, {
          cursor: pageParam,
          limit: LIST_PAGE_LIMIT,
        }),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? (lastPage.meta.next_cursor ?? null) : null,
    staleTime: 30_000,
    enabled: filter.groupBy === "",
  });
}

export function useFindingsGroups(filter: FindingsFilterV2) {
  return useQuery({
    queryKey: findingsListKeys.groups(filter),
    queryFn: () =>
      apiGet<FindingsGroupsPage>(
        "/api/v1/findings",
        buildQueryString(filter, { limit: LIST_PAGE_LIMIT }),
      ),
    staleTime: 30_000,
    enabled: filter.groupBy !== "",
  });
}

export function useFindingsFacets(filter: FindingsFilterV2) {
  return useQuery({
    queryKey: findingsListKeys.facets(filter),
    queryFn: () =>
      apiGet<FindingsFacetsResponse>(
        "/api/v1/findings/facets",
        buildQueryString(filter),
      ),
    staleTime: 30_000,
  });
}

export function useFinding(id: string) {
  return useQuery({
    queryKey: findingKeys.detail(id),
    queryFn: () => apiGet<FindingDetailResponse>(`/api/v1/findings/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      apiPatch<{ data: { status: string } }>(`/api/v1/findings/${id}/status`, {
        status,
      }),

    onSuccess: async (_result, variables) => {
      patchFindingStatusesInListCache(qc, [variables.id], variables.status);
      patchFindingStatusesInDetailCache(qc, [variables.id], variables.status);

      await Promise.all([
        qc.invalidateQueries({ queryKey: findingsKeys.all }),
        qc.invalidateQueries({ queryKey: findingKeys.detail(variables.id) }),
      ]);
    },
  });
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, status, note }: { ids: string[]; status: number; note?: string }) =>
      apiPatch<{ data: { succeeded: string[]; failed: Record<string, string> } }>("/api/v1/findings/bulk/status", {
        ids,
        status,
        note: note ?? "",
      }),

    onSuccess: async (_result, variables) => {
      patchFindingStatusesInListCache(qc, variables.ids, variables.status);
      patchFindingStatusesInDetailCache(qc, variables.ids, variables.status);

      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}

export function useBulkTriageAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, request }: { ids: string[]; request: TriageRequest }) => {
      if (request.action === "assign") {
        return apiPatch<{ data: { succeeded: string[]; failed: Record<string, string> } }>(
          "/api/v1/findings/bulk/assign",
          { ids, user_id: request.to_user_id },
        );
      }
      if (request.action === "change_status") {
        return apiPatch<{ data: { succeeded: string[]; failed: Record<string, string> } }>(
          "/api/v1/findings/bulk/status",
          { ids, status: request.status },
        );
      }
      if (request.action === "unassign") {
        return apiPost<{ data: { succeeded: string[]; failed: Record<string, string> } }>(
          "/api/v1/findings/bulk/unassign",
          { ids },
        );
      }
      throw new Error("unsupported bulk action");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}

export function useTriageAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, request }: { id: string; request: TriageRequest }) => {
      if (request.action === "assign") {
        await apiPost<{ data: { status: string } }>(`/api/v1/findings/${id}/assign`, {
          user_id: request.to_user_id,
        });
        return;
      }
      if (request.action === "unassign") {
        await apiDelete(`/api/v1/findings/${id}/assign`);
        return;
      }
      if (request.action === "reopen") {
        await apiPost<{ data: { status: string } }>(`/api/v1/findings/${id}/reopen`, {
          note: request.note ?? "",
        });
        return;
      }
      if (request.action === "close") {
        await apiPost<{ data: { status: string } }>(`/api/v1/findings/${id}/close`, {
          reason_code: request.reason_code,
          note: request.note ?? "",
        });
        return;
      }
      await apiPatch<{ data: { status: string } }>(`/api/v1/findings/${id}/status`, {
        status: request.status,
      });
      return;
    },
    onSuccess: async (_result, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: findingKeys.detail(vars.id) }),
        qc.invalidateQueries({ queryKey: findingsKeys.all }),
      ]);
    },
  });
}

export function useFindingHistory(id: string) {
  return useQuery({
    queryKey: [...findingKeys.detail(id), "history"] as const,
    queryFn: () => apiGet<PaginatedResponse<FindingEvent[]>>(`/api/v1/findings/${id}/events`),
    enabled: Boolean(id),
  });
}

export function useCloseFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reasonCode, note }: { id: string; reasonCode: string; note: string }) =>
      apiPost<{ data: { status: string } }>(`/api/v1/findings/${id}/close`, {
        reason_code: reasonCode,
        note,
      }),
    onSuccess: async (_r, v) => {
      await qc.invalidateQueries({ queryKey: findingKeys.detail(v.id) });
      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}

export function useReopenFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiPost<{ data: { status: string } }>(`/api/v1/findings/${id}/reopen`, { note: note ?? "" }),
    onSuccess: async (_r, v) => {
      await qc.invalidateQueries({ queryKey: findingKeys.detail(v.id) });
      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}

export function useAssignFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      apiPost<{ data: { status: string } }>(`/api/v1/findings/${id}/assign`, { user_id: userId }),
    onSuccess: async (_r, v) => {
      await qc.invalidateQueries({ queryKey: findingKeys.detail(v.id) });
      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}

export function useUnassignFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiDelete(`/api/v1/findings/${id}/assign`),
    onSuccess: async (_r, v) => {
      await qc.invalidateQueries({ queryKey: findingKeys.detail(v.id) });
      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}

export function useFindingEvents(id: string, limit = 50) {
  return useInfiniteQuery({
    queryKey: [...findingKeys.detail(id), "events", limit] as const,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiGet<PaginatedResponse<FindingEvent[]>>(
        `/api/v1/findings/${id}/events`,
        pageParam ? { cursor: pageParam, limit: String(limit) } : { limit: String(limit) },
      ),
    getNextPageParam: (lastPage) => (lastPage.meta.has_more ? (lastPage.meta.next_cursor ?? null) : null),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useClosureReasons() {
  return useQuery({
    queryKey: ["closure-reasons"] as const,
    queryFn: () => apiGet<{ data: ClosureReason[] }>("/api/v1/closure-reasons"),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useAssignableUsers(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["assignable-users", projectId] as const,
    queryFn: () => apiGet<{ data: AssignableUser[] }>(`/api/v1/projects/${projectId}/assignable-users`),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useBulkClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, reasonCode, note }: { ids: string[]; reasonCode: string; note: string }) =>
      apiPost<{ data: { succeeded: string[]; failed: Record<string, string> } }>("/api/v1/findings/bulk/close", {
        ids,
        reason_code: reasonCode,
        note,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}

export function useBulkAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, userId }: { ids: string[]; userId: string }) =>
      apiPost<{ data: { succeeded: string[]; failed: Record<string, string> } }>("/api/v1/findings/bulk/assign", {
        ids,
        user_id: userId,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}
