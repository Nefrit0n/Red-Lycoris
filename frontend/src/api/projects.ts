import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/client";
import type { Project, PaginatedResponse } from "@/types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () =>
      apiGet<PaginatedResponse<Project[]>>("/api/v1/projects", {
        limit: "200",
      }),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description: string; tags: string[] }) =>
      apiPost<{ data: Project }>("/api/v1/projects", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
