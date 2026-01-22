export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingStatus =
  | "new"
  | "under_review"
  | "confirmed"
  | "false_positive"
  | "out_of_scope"
  | "risk_accepted"
  | "mitigated"
  | "duplicate";
export type FindingOccurrenceStatus = "NEW" | "REPEAT";
export type FindingCategory = "SAST" | "SCA" | "SECRETS" | "CONFIG";

export interface FindingOwnerDTO {
  id: string;
  name: string;
}

export interface FindingListItemDTO {
  id: string;
  title: string;
  productId?: string | null;
  productName?: string | null;
  assigneeId?: string | null;
  owner?: FindingOwnerDTO | null;
  importJobId?: string | null;
  scannerType?: string | null;
  sourceType?: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  category: FindingCategory;
  occurrenceStatus?: FindingOccurrenceStatus | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  repeatCount?: number | null;
  createdAt: string;
  updatedAt: string;
  intel_summary?: IntelSummary | null;
}

export interface ApiResponse {
  data: FindingListItemDTO[];
  total: number;
}

export interface FetchFindingsParams {
  limit: number;
  offset: number;
  filterProduct?: string;
  filterProductId?: string;
  filterSeverity?: FindingSeverity | "";
  filterStatus?: FindingStatus | "";
  filterOccurrence?: FindingOccurrenceStatus | "";
  filterScannerType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  canonicalOnly?: boolean;
  includeRepeats?: boolean;
  importJobId?: string;
  sortField?: keyof FindingListItemDTO | "";
  sortOrder?: "asc" | "desc" | "";
}

export interface BulkUpdateResponse {
  affectedCount: number;
  sampleIds?: string[];
  prevStatuses?: Array<{
    id: string;
    status: FindingStatus;
  }>;
}

export interface FindingDetailsSAST {
  ruleId?: string | null;
  filePath?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  snippet?: string | null;
  message?: string | null;
  cwe?: string[] | null;
  owasp?: string[] | null;
}

export interface FindingDetailsSCA {
  pkgName: string;
  installedVersion: string;
  fixedVersion?: string | null;
  vulnerabilityId: string;
  primaryUrl?: string | null;
  ecosystem?: string | null;
  purl?: string | null;
  references?: string[] | null;
  rawSeverity?: string | null;
}

export interface FindingDetailsSecrets {
  ruleId?: string | null;
  filePath?: string | null;
  snippet?: string | null;
  message?: string | null;
}

export interface FindingDetailsConfig {
  ruleId?: string | null;
  filePath?: string | null;
  message?: string | null;
}

export type FindingDetails =
  | FindingDetailsSAST
  | FindingDetailsSCA
  | FindingDetailsSecrets
  | FindingDetailsConfig;

export interface FindingDetailBaseDTO extends FindingListItemDTO {
  description?: string | null;
  fingerprint?: string | null;
  sourceVersion?: string | null;
  endpointMethod?: string | null;
  endpointPath?: string | null;
  deletedAt?: string | null;
  comments: FindingComment[];
  events: FindingEvent[];
  occurrences?: FindingOccurrence[];
  duplicates?: FindingDuplicateGroup | null;
  evidence?: FindingEvidence | null;
  details?: FindingDetails | null;
  scaDetails?: ScaDetails | null;
  intel_summary?: IntelSummary | null;
  intel_details?: IntelDetail | null;
}

export interface FindingDetailSASTDTO extends FindingDetailBaseDTO {
  category: "SAST";
  details?: FindingDetailsSAST | null;
}

export interface FindingDetailSCADTO extends FindingDetailBaseDTO {
  category: "SCA";
  details?: FindingDetailsSCA | null;
}

export interface FindingDetailSecretsDTO extends FindingDetailBaseDTO {
  category: "SECRETS";
  details?: FindingDetailsSecrets | null;
}

export interface FindingDetailConfigDTO extends FindingDetailBaseDTO {
  category: "CONFIG";
  details?: FindingDetailsConfig | null;
}

export interface FindingDetailUnknownDTO extends FindingDetailBaseDTO {
  category: string;
  details?: unknown | null;
}

export type FindingDetailDTO =
  | FindingDetailSASTDTO
  | FindingDetailSCADTO
  | FindingDetailSecretsDTO
  | FindingDetailConfigDTO
  | FindingDetailUnknownDTO;

export interface ScaDetails {
  componentName: string;
  ecosystem?: string | null;
  purl?: string | null;
  installedVersion: string;
  fixedVersion?: string | null;
  vulnerabilityId: string;
  primaryUrl?: string | null;
  references?: string[] | null;
  rawSeverity?: string | null;
}

export interface IntelSummary {
  identifiers: string[];
  cvss?: {
    score?: number | null;
    version?: string | null;
  } | null;
  epss?: {
    score?: number | null;
    percentile?: number | null;
  } | null;
  kev: boolean;
  last_refreshed_at?: string | null;
}

export interface IntelDetail {
  identifiers: string[];
  nvd?: Record<string, unknown> | null;
  epss?: Record<string, unknown> | null;
  kev?: Record<string, unknown> | null;
  references?: Array<{
    title?: string | null;
    url: string;
  }> | null;
  updated_at?: string | null;
}

export interface FindingComment {
  id: string;
  authorId?: string | null;
  author?: string | null;
  body: string;
  createdAt: string;
}

export interface FindingEvent {
  id: string;
  actorId?: string | null;
  actor?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FindingDuplicateGroup {
  master: FindingListItemDTO;
  duplicates: FindingListItemDTO[];
}

export interface FindingOccurrence {
  id: string;
  importJobId?: string | null;
  seenAt: string;
  status: string;
  scannerType?: string | null;
  snippet?: string | null;
}

export interface FindingNeighbors {
  prevId?: string | null;
  nextId?: string | null;
  position: number;
  total: number;
}

export type FindingEvidence = Record<string, unknown>;

export interface SemgrepEvidenceRange {
  line?: number;
  col?: number;
}

export interface SemgrepEvidence extends FindingEvidence {
  scannerType?: string | null;
  ruleId?: string | null;
  path?: string | null;
  start?: SemgrepEvidenceRange | null;
  end?: SemgrepEvidenceRange | null;
  message?: string | null;
  severityRaw?: string | null;
  code?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type Finding = FindingListItemDTO;
export type FindingDetail = FindingDetailDTO;
