import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS_STATE } from "./types";
import { filtersToQuery, normalizeFilters, queryToFilters } from "./url";

const buildState = () => ({
  ...DEFAULT_FILTERS_STATE,
  page: 1,
  pageSize: 50,
  search: "  critical  ",
  severities: ["critical", "high"],
  statuses: ["new", "under_review"],
  categories: ["SAST", "SCA"],
  scannerTypes: ["trivy", "semgrep"],
  productIds: ["prod-1", "prod-2"],
  occurrences: ["NEW"],
  riskBands: ["high"],
  policyDecisions: ["fail"],
  datePreset: "7d",
  dateFrom: "2024-01-01",
  dateTo: "2024-01-10",
  showRepeats: true,
});

describe("filtersToQuery", () => {
  it("serializes arrays as repeated query params", () => {
    const params = filtersToQuery(buildState());
    expect(params.getAll("severity")).toEqual(["critical", "high"]);
    expect(params.getAll("scannerType")).toEqual(["trivy", "semgrep"]);
    expect(params.getAll("product")).toEqual(["prod-1", "prod-2"]);
  });
});

describe("queryToFilters", () => {
  it("round-trips through normalizeFilters", () => {
    const state = buildState();
    const params = filtersToQuery(state);
    const next = normalizeFilters(queryToFilters(params, DEFAULT_FILTERS_STATE));
    expect(next).toEqual(normalizeFilters(state));
  });
});
