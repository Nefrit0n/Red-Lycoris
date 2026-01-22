import { request, requestBlob, requestList } from "./client";

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

  return requestList<AnalysisJob>("/api/v1/analysis-jobs", {
    signal,
    query: searchParams,
  });
};

export const fetchAnalysisJob = async (id: string): Promise<AnalysisJob> => {
  return request<AnalysisJob>(`/api/v1/analysis-jobs/${id}`);
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

  return request<CreateAnalysisJobResponse>("/api/v1/analysis-jobs", {
    method: "POST",
    body: formData,
    json: false,
  });
};

export const downloadAnalysisArtifact = async (
  jobId: string,
  artifact: "semgrep" | "trivy"
): Promise<Blob> => {
  return requestBlob(`/api/v1/analysis-jobs/${jobId}/artifacts/${artifact}`);
};
