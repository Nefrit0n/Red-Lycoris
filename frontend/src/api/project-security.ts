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

export type ScanStatus = "open" | "completed" | "timed_out";

export interface ScanToolRunSummary {
  scanner: string;
  scanner_version?: string | null;
  status: "success" | "failed";
}

export interface ScanToolRun {
  id: string;
  scan_id: string;
  scanner: string;
  scanner_version?: string | null;
  report_format: string;
  status: "success" | "failed";
  error?: string | null;
  findings_imported: number;
  findings_updated: number;
  started_at: string;
  finished_at: string;
}

export interface ScanItem {
  id: string;
  project_id: string;
  ci_pipeline_id?: string | null;
  commit_sha?: string | null;
  branch?: string | null;
  ci_job_url?: string | null;
  status: ScanStatus;
  completion?: string | null;
  started_at: string;
  completed_at?: string | null;
  findings_imported: number;
  findings_updated: number;
  tool_runs?: ScanToolRunSummary[];
}

export interface ScanFindingItem {
  id: string;
  title: string;
  severity: number;
  file_path?: string | null;
  line_start?: number | null;
  cve_ids?: string[];
  tool_run_id?: string | null;
  is_new: boolean;
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

export function useProjectScans(
  projectId?: string,
  params?: Record<string, string>,
) {
  return useQuery({
    queryKey: ["project-scans", projectId, params],
    queryFn: async () =>
      apiGet<{ data: ScanItem[]; meta: { next_cursor: string; has_more: boolean } }>(
        `/api/v1/projects/${projectId}/scans`,
        params,
      ),
    enabled: Boolean(projectId),
  });
}

export function useScan(scanId?: string) {
  return useQuery({
    queryKey: ["scan", scanId],
    queryFn: async () =>
      apiGet<{ data: { scan: ScanItem; tool_runs: ScanToolRun[]; findings: ScanFindingItem[] } }>(
        `/api/v1/scans/${scanId}`,
      ),
    enabled: Boolean(scanId),
  });
}
