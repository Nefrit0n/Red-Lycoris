import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/api/client";
import type { Finding, PaginatedResponse } from "@/types";

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
  enrichments?: unknown[];
  score?: unknown;
}

export interface FindingDetailResponse {
  data: FindingDetailPayload;
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

      let changed = false;

      const pages = old.pages.map((page) => {
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
      apiPatch<{ status: string }>(`/api/v1/findings/${id}/status`, { status }),

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
    mutationFn: ({ ids, status }: { ids: string[]; status: number }) =>
      apiPatch<{ status: string; updated: number }>("/api/v1/findings/bulk/status", {
        ids,
        status,
      }),

    onSuccess: async (_result, variables) => {
      patchFindingStatusesInListCache(qc, variables.ids, variables.status);
      patchFindingStatusesInDetailCache(qc, variables.ids, variables.status);

      await qc.invalidateQueries({ queryKey: findingsKeys.all });
    },
  });
}
