import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/api/client";

export interface APITokenItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  created_by: { id: string; email: string };
}

export interface ScanItem {
  id: string;
  project_id: string;
  commit_sha: string;
  branch: string;
  scanner: string;
  scanner_version?: string | null;
  ci_job_url?: string | null;
  started_at: string;
  finished_at?: string | null;
  findings_imported: number;
  findings_updated: number;
  status: "running" | "completed" | "failed";
}

export function useProjectTokens(projectId?: string) {
  return useQuery({
    queryKey: ["project-api-tokens", projectId],
    queryFn: async () => {
      const res = await apiGet<{ data: APITokenItem[] }>(`/api/v1/projects/${projectId}/api-tokens`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateProjectToken(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; scopes: string[]; expires_in_days?: number | null }) =>
      apiPost<{ data: APITokenItem & { token: string } }>(`/api/v1/projects/${projectId}/api-tokens`, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-api-tokens", projectId] });
    },
  });
}

export function useRevokeProjectToken(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) => apiDelete(`/api/v1/projects/${projectId}/api-tokens/${tokenId}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-api-tokens", projectId] });
    },
  });
}

export function useProjectScans(projectId?: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: ["project-scans", projectId, params],
    queryFn: async () => apiGet<{ data: ScanItem[] }>(`/api/v1/projects/${projectId}/scans`, params),
    enabled: Boolean(projectId),
  });
}

export function useScan(scanId?: string) {
  return useQuery({
    queryKey: ["scan", scanId],
    queryFn: async () => apiGet<{ data: { scan: ScanItem; findings: any[] } }>(`/api/v1/scans/${scanId}`),
    enabled: Boolean(scanId),
  });
}
