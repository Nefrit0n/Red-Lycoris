import {
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../../types/findings";
import { DatePreset, FiltersState } from "./types";

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
const categoryOptions = ["SAST", "SCA", "DAST", "SECRETS", "IAC", "CONTAINER"];
const languageOptions = [
  "javascript",
  "typescript",
  "python",
  "java",
  "go",
  "ruby",
  "php",
  "csharp",
  "kotlin",
  "swift",
  "sql",
  "yaml",
  "json",
  "bash",
];
const datePresetOptions: DatePreset[] = ["24h", "7d", "30d", "90d", ""];

const uniq = <T,>(items: T[]): T[] => Array.from(new Set(items));
const sortValues = <T extends string>(items: T[]) => [...items].sort((a, b) => a.localeCompare(b));

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

const normalizeArray = <T extends string>(values: string[], allowed: T[]): T[] => {
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
  toArrayParam(params, "category", state.categories);
  toArrayParam(params, "scannerType", state.scannerTypes);
  toArrayParam(params, "language", state.languages);
  toArrayParam(params, "occurrenceStatus", state.occurrences);
  toArrayParam(params, "riskBand", state.riskBands);
  toArrayParam(params, "policyDecision", state.policyDecisions);

  if (state.search) params.set("search", state.search);
  if (state.importJobId) params.set("import_job_id", state.importJobId);
  if (state.datePreset) params.set("datePreset", state.datePreset);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);

  params.set("canonicalOnly", String(!state.showRepeats));
  params.set("includeRepeats", String(state.showRepeats));
  params.set("sortField", String(state.sortField));
  params.set("sortOrder", state.sortOrder);

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
  const categories = normalizeArray(readArrayParam(params, "category"), categoryOptions);
  const scannerTypes = uniq(readArrayParam(params, "scannerType"));
  const languages = normalizeArray(readArrayParam(params, "language"), languageOptions);
  const occurrences = normalizeArray(
    readArrayParam(params, "occurrenceStatus"),
    occurrenceOptions
  );
  const riskBands = normalizeArray(readArrayParam(params, "riskBand"), riskBandOptions);
  const policyDecisions = normalizeArray(
    readArrayParam(params, "policyDecision"),
    policyDecisionOptions
  );

  const search = params.get("search") ?? params.get("q") ?? "";
  const importJobId = params.get("import_job_id") ?? "";
  const datePreset = params.get("datePreset") ?? "";
  const resolvedDatePreset = datePresetOptions.includes(datePreset as DatePreset)
    ? (datePreset as DatePreset)
    : "";

  const includeRepeats = params.get("includeRepeats") === "true";
  const canonicalOnly = params.get("canonicalOnly");
  const showRepeats = includeRepeats || canonicalOnly === "false";

  const sortField = params.get("sortField") ?? base.sortField;
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";

  return {
    ...base,
    page: Math.max(0, page - 1),
    pageSize: limit > 0 ? limit : base.pageSize,
    productIds,
    search,
    importJobId,
    severities,
    statuses,
    categories,
    scannerTypes,
    languages,
    occurrences,
    riskBands,
    policyDecisions,
    datePreset: resolvedDatePreset,
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    showRepeats,
    sortField: sortField as FiltersState["sortField"],
    sortOrder,
  };
};

export const filtersAreEqual = (left: FiltersState, right: FiltersState): boolean => {
  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  return (
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    left.sortField === right.sortField &&
    left.sortOrder === right.sortOrder &&
    arraysEqual(left.productIds, right.productIds) &&
    left.search === right.search &&
    left.importJobId === right.importJobId &&
    arraysEqual(left.severities, right.severities) &&
    arraysEqual(left.statuses, right.statuses) &&
    arraysEqual(left.categories, right.categories) &&
    arraysEqual(left.scannerTypes, right.scannerTypes) &&
    arraysEqual(left.languages, right.languages) &&
    arraysEqual(left.occurrences, right.occurrences) &&
    arraysEqual(left.riskBands, right.riskBands) &&
    arraysEqual(left.policyDecisions, right.policyDecisions) &&
    left.datePreset === right.datePreset &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo &&
    left.showRepeats === right.showRepeats
  );
};

export const normalizeFilters = (state: FiltersState): FiltersState => {
  const normalize = <T extends string>(values: T[]) => values.filter(Boolean);
  return {
    ...state,
    page: Number.isFinite(state.page) ? Math.max(0, Math.floor(state.page)) : 0,
    pageSize:
      Number.isFinite(state.pageSize) && state.pageSize > 0
        ? Math.floor(state.pageSize)
        : 20,
    sortOrder: state.sortOrder === "asc" ? "asc" : "desc",
    search: state.search.trim(),
    importJobId: state.importJobId.trim(),
    productIds: sortValues(uniq(normalize(state.productIds))),
    severities: sortValues(
      normalizeArray(normalize(state.severities), severityOptions)
    ),
    statuses: sortValues(normalizeArray(normalize(state.statuses), statusOptions)),
    categories: sortValues(normalizeArray(normalize(state.categories), categoryOptions)),
    scannerTypes: sortValues(uniq(normalize(state.scannerTypes))),
    languages: sortValues(normalizeArray(normalize(state.languages), languageOptions)),
    occurrences: sortValues(
      normalizeArray(normalize(state.occurrences), occurrenceOptions)
    ),
    riskBands: sortValues(normalizeArray(normalize(state.riskBands), riskBandOptions)),
    policyDecisions: sortValues(
      normalizeArray(normalize(state.policyDecisions), policyDecisionOptions)
    ),
    datePreset: datePresetOptions.includes(state.datePreset) ? state.datePreset : "",
  };
};

export const countActiveFilters = (state: FiltersState): number => {
  const filtersCount =
    state.productIds.length +
    state.severities.length +
    state.statuses.length +
    state.scannerTypes.length +
    state.languages.length +
    state.policyDecisions.length +
    state.occurrences.length +
    state.riskBands.length +
    state.categories.length;
  const searchCount = state.search.trim() ? 1 : 0;
  const importJobCount = state.importJobId.trim() ? 1 : 0;
  const dateCount = state.datePreset || state.dateFrom || state.dateTo ? 1 : 0;
  const repeatsCount = state.showRepeats ? 1 : 0;
  return filtersCount + searchCount + importJobCount + dateCount + repeatsCount;
};
