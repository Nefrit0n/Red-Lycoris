import {
  FindingCategory,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
  FindingListItemDTO,
} from "./findings";

export type DatePreset = "24h" | "7d" | "30d" | "90d" | "";

export interface FiltersState {
  page: number;
  pageSize: number;

  productIds: string[];
  search: string;
  severities: FindingSeverity[];
  statuses: FindingStatus[];
  scannerTypes: string[];
  policyDecisions: PolicyDecision[];
  occurrences: FindingOccurrenceStatus[];
  riskBands: RiskBand[];
  categories: FindingCategory[];

  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;

  importJobId: string;

  sortField: keyof FindingListItemDTO;
  sortOrder: "asc" | "desc";

  selectedFindingId: string | null;
}

export const DEFAULT_FILTERS_STATE: FiltersState = {
  page: 0,
  pageSize: 20,
  productIds: [],
  search: "",
  severities: [],
  statuses: [],
  scannerTypes: [],
  policyDecisions: [],
  occurrences: [],
  riskBands: [],
  categories: [],
  datePreset: "",
  dateFrom: "",
  dateTo: "",
  showRepeats: false,
  importJobId: "",
  sortField: "lastSeenAt",
  sortOrder: "desc",
  selectedFindingId: null,
};
