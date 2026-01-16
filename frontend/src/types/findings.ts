export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingStatus = "new" | "duplicate" | "resolved" | "ignored";

export interface Finding {
  id: string;
  title: string;
  productId?: string | null;
  productName?: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse {
  data: Finding[];
  total: number;
}

export interface FetchFindingsParams {
  page: number;
  pageSize: number;
  filterProductId?: string;
  filterSeverity?: FindingSeverity | "";
  filterStatus?: FindingStatus | "";
  sortField?: keyof Finding | "";
  sortOrder?: "asc" | "desc" | "";
}

export interface FindingDetail {
  id: string;
  title: string;
  description?: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  productId?: string | null;
  productName?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
