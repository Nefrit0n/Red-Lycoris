import { request, requestBlob, requestList } from "./client";
import { uploadFormDataWithProgress } from "./upload";

export interface AnalysisJobScannerDetail {
  scanner: string;
  status: string;
  hasArtifact: boolean;
  importJobId?: string;
  errorMessage?: string;
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
  resultCount?: number;
  maxSeverity?: string;
  severityCounts?: string;
}

export interface AnalysisJob {
  id: string;
  productId?: string;
  productName?: string;
  engagementId?: string;
  sourceSnapshotId?: string;
  sourceKind?: string;
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
  scannerDetails?: AnalysisJobScannerDetail[];
}

export interface CreateAnalysisJobRequest {
  productId: string;
  engagementId?: string;
  scanners: string[];
  archive?: File;
  sourceSnapshotId?: string;
  sourceMode?: "latest";
  idempotencyKey?: string;
  onProgress?: (progress: number) => void;
}

export interface CreateAnalysisJobResponse {
  id: string;
  status: string;
}

/** Canonical scanner catalog — must match backend models.ScannerCatalog */
export type ScannerCategory = "SAST" | "SCA" | "IAC" | "SECRETS";

export interface ScannerInfo {
  id: string;
  name: string;
  category: ScannerCategory;
  description: string;
  estimatedTime: string;
}

export const SCANNER_CATALOG: ScannerInfo[] = [
  { id: "opengrep", name: "OpenGrep", category: "SAST", description: "Поиск уязвимостей в коде и конфигурации", estimatedTime: "2-5 мин" },
  { id: "trivy", name: "Trivy", category: "SCA", description: "Зависимости, CVE, секреты, misconfig", estimatedTime: "1-3 мин" },
  { id: "checkov", name: "Checkov", category: "IAC", description: "Terraform, K8s, CloudFormation, Dockerfiles", estimatedTime: "1-2 мин" },
  { id: "kics", name: "KICS", category: "IAC", description: "IaC misconfigurations", estimatedTime: "1-3 мин" },
  { id: "gitleaks", name: "Gitleaks", category: "SECRETS", description: "Поиск секретов и ключей в коде", estimatedTime: "~30 сек" },
  { id: "grype", name: "Grype", category: "SCA", description: "SCA уязвимости зависимостей", estimatedTime: "1-2 мин" },
];

export const SCANNER_PRESETS = {
  fast: { label: "Быстрый", scanners: ["opengrep", "trivy"] },
  full: { label: "Полный", scanners: ["opengrep", "trivy", "checkov", "kics", "gitleaks", "grype"] },
  iac: { label: "IaC", scanners: ["checkov", "kics", "trivy"] },
  secrets: { label: "Секреты", scanners: ["gitleaks", "trivy"] },
} as const;

export type PresetKey = keyof typeof SCANNER_PRESETS;

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
  const hasArchive = Boolean(payload.archive);
  const hasSnapshot = Boolean(payload.sourceSnapshotId);
  const hasLatest = payload.sourceMode === "latest";
  if ((hasArchive && (hasSnapshot || hasLatest)) || (hasSnapshot && hasLatest)) {
    throw new Error("Архив, снапшот и режим latest нельзя комбинировать.");
  }
  if (!hasArchive && !hasSnapshot && !hasLatest) {
    throw new Error("Добавьте архив или выберите снапшот.");
  }
  const formData = new FormData();
  formData.append("product_id", payload.productId);
  if (payload.archive) {
    formData.append("archive", payload.archive);
  }
  if (payload.engagementId) {
    formData.append("engagement_id", payload.engagementId);
  }
  if (payload.scanners.length > 0) {
    formData.append("scanners", payload.scanners.join(","));
  }
  if (payload.sourceSnapshotId) {
    formData.append("source_snapshot_id", payload.sourceSnapshotId);
  }
  if (payload.sourceMode === "latest") {
    formData.append("source_mode", "latest");
  }

  if (payload.archive && payload.onProgress) {
    return uploadFormDataWithProgress<CreateAnalysisJobResponse>({
      url: "/api/v1/analysis-jobs",
      formData,
      idempotencyKey: payload.idempotencyKey,
      onProgress: payload.onProgress,
    });
  }

  return request<CreateAnalysisJobResponse>("/api/v1/analysis-jobs", {
    method: "POST",
    body: formData,
    json: false,
    headers: payload.idempotencyKey ? { "Idempotency-Key": payload.idempotencyKey } : undefined,
  });
};

export const downloadAnalysisArtifact = async (
  jobId: string,
  artifact: string
): Promise<Blob> => {
  return requestBlob(`/api/v1/analysis-jobs/${jobId}/artifacts/${artifact}`);
};
