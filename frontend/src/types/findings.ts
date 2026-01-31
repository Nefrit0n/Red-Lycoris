export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type RiskBand = "low" | "medium" | "high" | "critical";
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
export type FindingCategory = "SAST" | "SCA" | "SECRETS" | "CONFIG" | "IAC" | "CONTAINER" | "DAST";
export type PolicyDecision = "pass" | "fail" | "warn";

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
  policyDecision?: PolicyDecision | null;
  scannerType?: string | null;
  sourceType?: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  category: FindingCategory;
  occurrenceStatus?: FindingOccurrenceStatus | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  repeatCount?: number | null;
  slaDueAt?: string | null;
  slaBreached?: boolean | null;
  slaBreachedAt?: string | null;
  slaProfile?: string | null;
  slaSource?: string | null;
  slaDaysRemaining?: number | null;
  createdAt: string;
  updatedAt: string;
  riskScore?: number | null;
  riskBand?: RiskBand | null;
  riskUpdatedAt?: string | null;
  modelVersion?: string | null;
  intel_summary?: IntelSummary | null;
  // SAST-specific fields (populated from evidence for SAST category)
  cwe?: string[] | null;
  owasp?: string[] | null;
}

export interface FindingsListResponse {
  data: FindingListItemDTO[];
  total?: number;
  meta?: {
    hasNext?: boolean;
    total?: number;
    severityCounts?: Record<string, number>;
    statusCounts?: Record<string, number>;
  };
}

export interface FetchFindingsParams {
  limit: number;
  offset?: number;
  includeMeta?: boolean;
  filterProduct?: string;
  filterProductId?: string;
  filterSeverity?: FindingSeverity | "";
  filterStatus?: FindingStatus | "";
  filterRiskBand?: RiskBand | "";
  filterOccurrence?: FindingOccurrenceStatus | "";
  filterScannerType?: string;
  filterPolicyDecision?: PolicyDecision | "";
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

export interface FindingDetailsIAC {
  ruleId?: string | null;
  filePath?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  message?: string | null;
  resource?: string | null;
  checkType?: string | null;
  framework?: string | null;
}

export interface FindingDetailsContainer {
  pkgName?: string | null;
  installedVersion?: string | null;
  fixedVersion?: string | null;
  vulnerabilityId?: string | null;
  imageRef?: string | null;
  ecosystem?: string | null;
  purl?: string | null;
  primaryUrl?: string | null;
  references?: string[] | null;
  fixState?: string | null;
}

export interface FindingDetailsDAST {
  ruleId?: string | null;
  url?: string | null;
  method?: string | null;
  parameter?: string | null;
  evidence?: string | null;
  message?: string | null;
  templateId?: string | null;
}

export type FindingDetails =
  | FindingDetailsSAST
  | FindingDetailsSCA
  | FindingDetailsSecrets
  | FindingDetailsConfig
  | FindingDetailsIAC
  | FindingDetailsContainer
  | FindingDetailsDAST;

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
  riskFactors?: RiskFactors | null;
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

export interface FindingDetailIACDTO extends FindingDetailBaseDTO {
  category: "IAC";
  details?: FindingDetailsIAC | null;
}

export interface FindingDetailContainerDTO extends FindingDetailBaseDTO {
  category: "CONTAINER";
  details?: FindingDetailsContainer | null;
}

export interface FindingDetailDASTDTO extends FindingDetailBaseDTO {
  category: "DAST";
  details?: FindingDetailsDAST | null;
}

export interface FindingDetailUnknownDTO extends Omit<FindingDetailBaseDTO, 'details' | 'category'> {
  category: string;
  details?: Record<string, unknown> | null;
}

export type FindingDetailDTO =
  | FindingDetailSASTDTO
  | FindingDetailSCADTO
  | FindingDetailSecretsDTO
  | FindingDetailConfigDTO
  | FindingDetailIACDTO
  | FindingDetailContainerDTO
  | FindingDetailDASTDTO
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

export interface RiskFactors {
  impact?: {
    value?: number;
    cvss_score?: number;
    severity?: string;
  };
  likelihood?: {
    epss_score?: number;
    kev?: boolean;
    value?: number;
    known?: boolean;
    reason?: string;
  };
  asset?: {
    criticality?: string;
    multiplier?: number;
    environment?: string;
    environment_multiplier?: number;
    internet_exposed?: boolean;
    exposure_multiplier?: number;
  };
  freshness?: {
    enabled?: boolean;
    age_days?: number;
    multiplier?: number;
  };
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
