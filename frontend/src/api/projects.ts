import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/api/client";
import type { Project, PaginatedResponse } from "@/types";

export interface ProjectsQueryParams {
  limit?: number;
  cursor?: string;
  view?: "grid" | "list";
  status?: string[];
  team?: string;
  sla?: string;
  tag?: string[];
  q?: string;
  sort?: string;
  owner?: string;
}

function buildProjectsParams(query: ProjectsQueryParams): Record<string, string> {
  const out: Record<string, string> = {
    limit: String(query.limit ?? 200),
  };

  if (query.cursor) out.cursor = query.cursor;
  if (query.view) out.view = query.view;
  if (query.status && query.status.length > 0) out.status = query.status.join(",");
  if (query.team) out.team = query.team;
  if (query.sla) out.sla = query.sla;
  if (query.tag && query.tag.length > 0) out.tag = query.tag.join(",");
  if (query.q) out.q = query.q;
  if (query.sort) out.sort = query.sort;
  if (query.owner) out.owner = query.owner;

  return out;
}

export function useProjects(query: ProjectsQueryParams = {}) {
  const params = buildProjectsParams(query);
  return useQuery({
    queryKey: ["projects", params],
    queryFn: () =>
      apiGet<PaginatedResponse<Project[]>>("/api/v1/projects", {
        ...params,
      }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<{ data: Project }>("/api/v1/projects", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function usePatchProjectPinned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; pinned: boolean }) =>
      apiPatch<{ data: { id: string; pinned: boolean } }>(
        `/api/v1/projects/${payload.id}/pinned`,
        { pinned: payload.pinned },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
