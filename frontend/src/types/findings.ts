export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingStatus = "new" | "duplicate" | "resolved" | "ignored";

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
