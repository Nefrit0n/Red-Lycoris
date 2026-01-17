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
  productId?: string | null;
  productName?: string | null;
  assigneeId?: string | null;
  owner?: FindingOwner | null;
  importJobId?: string | null;
  scannerType?: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  occurrenceStatus?: FindingOccurrenceStatus | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  repeatCount?: number | null;
  createdAt: string;
  updatedAt: string;
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
