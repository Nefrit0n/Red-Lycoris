import { getAuthHeaders, parseApiResponse, parseListApiResponse } from "./http";

export interface AnalysisJob {
  id: string;
  productId?: string;
  productName?: string;
  engagementId?: string;
  status: string;
  scanners: string[];
  semgrepStatus: string;
  trivyStatus: string;
  findingsTotal: number;
  findingsNew: number;
  duplicatesTotal: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationSeconds?: number;
  artifactSemgrep: boolean;
  artifactTrivy: boolean;
  semgrepImportJobId?: string;
  trivyImportJobId?: string;
  errorMessage?: string;
}

export interface CreateAnalysisJobRequest {
  productId: string;
  engagementId?: string;
  scanners: string[];
  archive: File;
}

export interface CreateAnalysisJobResponse {
  id: string;
  status: string;
}

export const fetchAnalysisJobs = async (
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<{ data: AnalysisJob[]; total: number }> => {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await fetch(`/api/v1/analysis-jobs?${searchParams.toString()}`, {
    method: "GET",
    headers: getAuthHeaders(),
    signal,
  });

  return parseListApiResponse<AnalysisJob>(response);
};

export const fetchAnalysisJob = async (id: string): Promise<AnalysisJob> => {
  const response = await fetch(`/api/v1/analysis-jobs/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return parseApiResponse<AnalysisJob>(response);
};

export const createAnalysisJob = async (
  payload: CreateAnalysisJobRequest
): Promise<CreateAnalysisJobResponse> => {
  const formData = new FormData();
  formData.append("product_id", payload.productId);
  formData.append("archive", payload.archive);
  if (payload.engagementId) {
    formData.append("engagement_id", payload.engagementId);
  }
  if (payload.scanners.length > 0) {
    formData.append("scanners", payload.scanners.join(","));
  }

  const response = await fetch("/api/v1/analysis-jobs", {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return parseApiResponse<CreateAnalysisJobResponse>(response);
};

export const downloadAnalysisArtifact = async (
  jobId: string,
  artifact: "semgrep" | "trivy"
): Promise<Blob> => {
  const response = await fetch(`/api/v1/analysis-jobs/${jobId}/artifacts/${artifact}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Artifact not ready");
  }

  return response.blob();
};
