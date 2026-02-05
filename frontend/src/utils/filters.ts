import {
  FindingCategory,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../types/findings";
import { FiltersState, DatePreset } from "../types/filters";

const severityOptions: FindingSeverity[] = ["low", "medium", "high", "critical"];
const statusOptions: FindingStatus[] = [
  "new",
  "under_review",
  "confirmed",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "mitigated",
  "duplicate",
];
const occurrenceOptions: FindingOccurrenceStatus[] = ["NEW", "REPEAT"];
const riskBandOptions: RiskBand[] = ["low", "medium", "high", "critical"];
const policyDecisionOptions: PolicyDecision[] = ["pass", "fail", "warn"];
const categoryOptions: FindingCategory[] = [
  "SAST",
  "SCA",
  "SECRETS",
  "DAST",
  "CONFIG",
  "IAC",
  "CONTAINER",
];
const datePresetOptions: DatePreset[] = ["24h", "7d", "30d", "90d", ""];

const uniq = <T,>(items: T[]): T[] => Array.from(new Set(items));

const toArrayParam = (params: URLSearchParams, key: string, values: string[]) => {
  values.forEach((value) => {
    if (value !== "") {
      params.append(key, value);
    }
  });
};

const readArrayParam = (params: URLSearchParams, key: string) => {
  const values = params.getAll(key).flatMap((value) => {
    if (value.includes(",")) {
      return value.split(",").map((part) => part.trim());
    }
    return value;
  });
  return values.filter(Boolean);
};

const normalizeArray = <T extends string>(
  values: string[],
  allowed: T[]
): T[] => {
  const allowedSet = new Set(allowed);
  return uniq(values.filter((value) => allowedSet.has(value as T)) as T[]);
};

export const filtersToQuery = (state: FiltersState): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", String(state.page + 1));
  params.set("limit", String(state.pageSize));

  toArrayParam(params, "product", state.productIds);
  toArrayParam(params, "severity", state.severities);
  toArrayParam(params, "status", state.statuses);
  toArrayParam(params, "scannerType", state.scannerTypes);
  toArrayParam(params, "policyDecision", state.policyDecisions);
  toArrayParam(params, "occurrenceStatus", state.occurrences);
  toArrayParam(params, "riskBand", state.riskBands);
  toArrayParam(params, "category", state.categories);

  if (state.search) params.set("search", state.search);
  if (state.datePreset) params.set("datePreset", state.datePreset);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  if (state.importJobId) params.set("import_job_id", state.importJobId);

  params.set("canonicalOnly", String(!state.showRepeats));
  params.set("includeRepeats", String(state.showRepeats));

  if (state.sortField) params.set("sortField", String(state.sortField));
  if (state.sortOrder) params.set("sortOrder", state.sortOrder);
  if (state.selectedFindingId) params.set("selected", state.selectedFindingId);

  return params;
};

export const queryToFilters = (params: URLSearchParams, base: FiltersState): FiltersState => {
  const page = Number(params.get("page")) || base.page + 1;
  const limit = Number(params.get("limit")) || base.pageSize;

  const productParams = readArrayParam(params, "product");
  const productIdParams = readArrayParam(params, "productId");
  const productIds = uniq([...productParams, ...productIdParams]);

  const severities = normalizeArray(readArrayParam(params, "severity"), severityOptions);
  const statuses = normalizeArray(readArrayParam(params, "status"), statusOptions);
  const scannerTypes = uniq(readArrayParam(params, "scannerType"));
  const policyDecisions = normalizeArray(
    readArrayParam(params, "policyDecision"),
    policyDecisionOptions
  );
  const occurrences = normalizeArray(
    readArrayParam(params, "occurrenceStatus"),
    occurrenceOptions
  );
  const riskBands = normalizeArray(readArrayParam(params, "riskBand"), riskBandOptions);
  const categories = normalizeArray(readArrayParam(params, "category"), categoryOptions);

  const search = params.get("search") ?? params.get("q") ?? "";
  const datePreset = params.get("datePreset") ?? "";
  const resolvedDatePreset = datePresetOptions.includes(datePreset as DatePreset)
    ? (datePreset as DatePreset)
    : "";

  const includeRepeats = params.get("includeRepeats") === "true";
  const canonicalOnly = params.get("canonicalOnly");
  const showRepeats = includeRepeats || canonicalOnly === "false";

  const sortField = params.get("sortField") ?? base.sortField;
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  const selectedFindingId = params.get("selected");

  return {
    ...base,
    page: Math.max(0, page - 1),
    pageSize: limit > 0 ? limit : base.pageSize,
    productIds,
    search,
    severities,
    statuses,
    scannerTypes,
    policyDecisions,
    occurrences,
    riskBands,
    categories,
    datePreset: resolvedDatePreset,
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    showRepeats,
    importJobId: params.get("import_job_id") ?? "",
    sortField: sortField as FiltersState["sortField"],
    sortOrder,
    selectedFindingId: selectedFindingId || null,
  };
};

export const filtersAreEqual = (left: FiltersState, right: FiltersState): boolean => {
  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  return (
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    arraysEqual(left.productIds, right.productIds) &&
    left.search === right.search &&
    arraysEqual(left.severities, right.severities) &&
    arraysEqual(left.statuses, right.statuses) &&
    arraysEqual(left.scannerTypes, right.scannerTypes) &&
    arraysEqual(left.policyDecisions, right.policyDecisions) &&
    arraysEqual(left.occurrences, right.occurrences) &&
    arraysEqual(left.riskBands, right.riskBands) &&
    arraysEqual(left.categories, right.categories) &&
    left.datePreset === right.datePreset &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo &&
    left.showRepeats === right.showRepeats &&
    left.importJobId === right.importJobId &&
    left.sortField === right.sortField &&
    left.sortOrder === right.sortOrder &&
    left.selectedFindingId === right.selectedFindingId
  );
};

export const normalizeFilters = (state: FiltersState): FiltersState => {
  const normalize = <T extends string>(values: T[]) => values.filter(Boolean);
  return {
    ...state,
    productIds: uniq(normalize(state.productIds)),
    severities: uniq(normalize(state.severities)),
    statuses: uniq(normalize(state.statuses)),
    scannerTypes: uniq(normalize(state.scannerTypes)),
    policyDecisions: uniq(normalize(state.policyDecisions)),
    occurrences: uniq(normalize(state.occurrences)),
    riskBands: uniq(normalize(state.riskBands)),
    categories: uniq(normalize(state.categories)),
  };
};

export const countActiveFilters = (state: FiltersState): number => {
  const filtersCount =
    state.productIds.length +
    state.severities.length +
    state.statuses.length +
    state.scannerTypes.length +
    state.policyDecisions.length +
    state.occurrences.length +
    state.riskBands.length +
    state.categories.length;
  const searchCount = state.search.trim() ? 1 : 0;
  const dateCount = state.datePreset || state.dateFrom || state.dateTo ? 1 : 0;
  const repeatsCount = state.showRepeats ? 1 : 0;
  return filtersCount + searchCount + dateCount + repeatsCount;
};
