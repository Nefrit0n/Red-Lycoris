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

export interface FindingOwner {
  id: string;
  name: string;
}

export interface Finding {
  id: string;
  title: string;
  description?: string | null;
  ruleId?: string | null;
  location?: string | null;
  productId?: string | null;
  productName?: string | null;
  assigneeId?: string | null;
  owner?: FindingOwner | null;
  importJobId?: string | null;
  scannerType?: string | null;
  evidence?: FindingEvidence | null;
  severity: FindingSeverity;
  status: FindingStatus;
  occurrenceStatus?: FindingOccurrenceStatus | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  repeatCount?: number | null;
  createdAt: string;
  updatedAt: string;
  intel_summary?: IntelSummary | null;
}

export interface ApiResponse {
  data: Finding[];
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
  sortField?: keyof Finding | "";
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

export interface FindingDetail {
  id: string;
  title: string;
  description?: string | null;
  fingerprint?: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  occurrenceStatus?: FindingOccurrenceStatus | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  repeatCount?: number | null;
  productId?: string | null;
  productName?: string | null;
  assigneeId?: string | null;
  owner?: FindingOwner | null;
  importJobId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  comments: FindingComment[];
  events: FindingEvent[];
  occurrences?: FindingOccurrence[];
  duplicates?: FindingDuplicateGroup | null;
  evidence?: FindingEvidence | null;
  intel_summary?: IntelSummary | null;
  intel_details?: IntelDetail | null;
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
  master: Finding;
  duplicates: Finding[];
}

export interface FindingOccurrence {
  id: string;
  importJobId?: string | null;
  seenAt: string;
  status: FindingStatus;
  scannerType?: string | null;
  snippet?: string | null;
}

export interface FindingNeighbors {
  prevId?: string | null;
  nextId?: string | null;
  position: number;
  total: number;
}

export interface SemgrepEvidenceRange {
  line?: number;
  col?: number;
}

export interface SemgrepEvidence {
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

export interface TrivyEvidence {
  tool?: string | null;
  type?: string | null;
  target?: string | null;
  class?: string | null;
  targetType?: string | null;
  vulnerabilityId?: string | null;
  severityRaw?: string | null;
  pkgName?: string | null;
  installedVersion?: string | null;
  fixedVersion?: string | null;
  purl?: string | null;
  primaryUrl?: string | null;
  title?: string | null;
  description?: string | null;
  references?: string[] | null;
  cweIds?: string[] | null;
  cvss?: Record<string, unknown> | null;
  publishedDate?: string | null;
  lastModifiedDate?: string | null;
  datasource?: Record<string, unknown> | null;
  trivyFingerprint?: string | null;
}

export type FindingEvidence = SemgrepEvidence | TrivyEvidence;
