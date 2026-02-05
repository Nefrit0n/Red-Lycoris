import {
  FindingListItemDTO,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../../types/findings";

export type DatePreset = "24h" | "7d" | "30d" | "90d" | "";

export interface FiltersState {
  page: number;
  pageSize: number;
  sortField: keyof FindingListItemDTO;
  sortOrder: "asc" | "desc";
  search: string;
  severities: FindingSeverity[];
  statuses: FindingStatus[];
  categories: string[];
  scannerTypes: string[];
  productIds: string[];
  occurrences: FindingOccurrenceStatus[];
  riskBands: RiskBand[];
  policyDecisions: PolicyDecision[];

  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;
}

export const DEFAULT_FILTERS_STATE: FiltersState = {
  page: 0,
  pageSize: 20,
  sortField: "lastSeenAt",
  sortOrder: "desc",
  search: "",
  severities: [],
  statuses: [],
  categories: [],
  scannerTypes: [],
  productIds: [],
  occurrences: [],
  riskBands: [],
  policyDecisions: [],
  datePreset: "",
  dateFrom: "",
  dateTo: "",
  showRepeats: false,
};
