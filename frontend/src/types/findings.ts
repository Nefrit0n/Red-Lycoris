export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingStatus = "new" | "duplicate" | "resolved" | "ignored";
export type FindingDetailStatus = "open" | "closed" | "false_positive";

export interface Finding {
  id: string;
  title: string;
  productName: string;
  severity: FindingSeverity;
  status: FindingStatus;
  createdAt: string;
}

export interface ApiResponse {
  data: Finding[];
  total: number;
}

export interface FetchFindingsParams {
  page: number;
  pageSize: number;
  filterApp?: string;
  filterSeverity?: FindingSeverity | "";
  filterStatus?: FindingStatus | "";
  sortField?: keyof Finding | "";
  sortOrder?: "asc" | "desc" | "";
}

export interface HistoryItem {
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
}

export interface FindingDetail {
  id: string;
  title: string;
  description: string;
  path: string;
  stepsToReproduce: string;
  recommendation: string;
  severity: FindingSeverity;
  status: FindingDetailStatus;
  createdAt: string;
  updatedAt: string;
  responsible: { id: string; name: string } | null;
  history: HistoryItem[];
}
