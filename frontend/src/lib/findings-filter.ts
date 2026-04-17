// Single source of truth for the findings list filter/sort state. The whole
// FindingsList page is URL-driven: every filter, sort order and group_by
// selection is serialized into the query string so deep links, back/forward
// navigation and saved views all round-trip cleanly.
//
// Backend is the source of truth for the wire format — we mirror its param
// names exactly (see backend/internal/api/findings.go parseFindingsFilter).

import { parseSeverity } from "@/lib/severity";
import { isFindingKind } from "@/lib/finding-kind";
import type { FindingKind } from "@/types";

export type SortField =
  | "first_seen"
  | "last_seen"
  | "severity"
  | "priority_score";

export type SortDir = "asc" | "desc";

export type GroupBy = "cve" | "component" | "rule" | "";

export interface FindingsFilter {
  // Free-text search (mapped to ?q=)
  query: string;

  // Multi-select chips.
  severities: number[];
  statuses: number[];
  kinds: FindingKind[];

  // Project scope. Backend currently accepts a single project_id — keep an
  // array shape client-side so multi-select UI can be added later without
  // breaking saved views.
  projectIds: string[];

  // Forward-compatible slots. These are serialized into the URL even though
  // the backend does not yet filter on them; the idea is to keep saved views
  // stable while backend support grows.
  sources: string[];
  ecosystems: string[];
  iacProviders: string[];
  secretKinds: string[];
  assigneeMe: boolean;
  unassigned: boolean;
  assignees: string[];

  // Single-field filters.
  cve: string;
  component: string;
  componentVersion: string;
  ruleId: string;
  cwe: number | null;

  // Enrichment toggles.
  hasCVE: boolean;
  hasFix: boolean;
  inKEV: boolean;
  inBDU: boolean;

  // Numeric thresholds.
  epssMin: number | null; // 0..1
  cvssMin: number | null; // 0..10
  ageMaxDays: number | null;

  // Sorting + grouping.
  sortField: SortField;
  sortDir: SortDir;
  groupBy: GroupBy;
}

export const DEFAULT_FINDINGS_FILTER: FindingsFilter = {
  query: "",
  severities: [],
  statuses: [],
  kinds: [],
  projectIds: [],
  sources: [],
  ecosystems: [],
  iacProviders: [],
  secretKinds: [],
  assigneeMe: false,
  unassigned: false,
  assignees: [],
  cve: "",
  component: "",
  componentVersion: "",
  ruleId: "",
  cwe: null,
  hasCVE: false,
  hasFix: false,
  inKEV: false,
  inBDU: false,
  epssMin: null,
  cvssMin: null,
  ageMaxDays: null,
  sortField: "first_seen",
  sortDir: "desc",
  groupBy: "",
};

const SORT_FIELDS: readonly SortField[] = [
  "first_seen",
  "last_seen",
  "severity",
  "priority_score",
];

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntOrNull(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function parseFloatOrNull(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string | null): boolean {
  return raw === "true" || raw === "1";
}

export function filterFromSearchParams(
  params: URLSearchParams,
): FindingsFilter {
  const severities = parseCsv(params.get("severity"))
    .map((s) => parseSeverity(s))
    .filter((n): n is number => n !== null);

  const statuses = parseCsv(params.get("status"))
    .map((s) => parseIntOrNull(s))
    .filter((n): n is number => n !== null && n >= 0 && n <= 4);

  const kinds = parseCsv(params.get("kinds")).filter(isFindingKind);

  const projectId = params.get("project_id");
  const projectIds = projectId ? [projectId] : [];

  const rawSort = params.get("sort") ?? "";
  const sortField = SORT_FIELDS.includes(rawSort as SortField)
    ? (rawSort as SortField)
    : DEFAULT_FINDINGS_FILTER.sortField;

  const rawDir = params.get("dir") ?? "";
  const sortDir: SortDir = rawDir === "asc" ? "asc" : "desc";

  const rawGroup = params.get("group_by") ?? "";
  const groupBy: GroupBy =
    rawGroup === "cve" || rawGroup === "component" || rawGroup === "rule"
      ? rawGroup
      : "";

  const epssMin = parseFloatOrNull(params.get("epss_min"));
  const cvssMin = parseFloatOrNull(params.get("cvss_min"));
  const ageMaxDays = parseIntOrNull(params.get("age_max_days"));

  return {
    query: params.get("q") ?? "",
    severities,
    statuses,
    kinds,
    projectIds,
    sources: parseCsv(params.get("sources")),
    ecosystems: parseCsv(params.get("ecosystems")),
    iacProviders: parseCsv(params.get("iac_providers")),
    secretKinds: parseCsv(params.get("secret_kinds")),
    assigneeMe: params.get("assignee") === "me",
    unassigned: parseBool(params.get("unassigned")),
    assignees: parseCsv(params.get("assignees")),
    cve: params.get("cve") ?? "",
    component: params.get("component") ?? "",
    componentVersion: params.get("component_version") ?? "",
    ruleId: params.get("rule_id") ?? "",
    cwe: parseIntOrNull(params.get("cwe")),
    hasCVE: parseBool(params.get("has_cve")),
    hasFix: parseBool(params.get("has_fix")),
    inKEV: parseBool(params.get("in_kev")),
    inBDU: parseBool(params.get("in_bdu")),
    epssMin: epssMin !== null && epssMin >= 0 && epssMin <= 1 ? epssMin : null,
    cvssMin: cvssMin !== null && cvssMin >= 0 && cvssMin <= 10 ? cvssMin : null,
    ageMaxDays: ageMaxDays !== null && ageMaxDays > 0 ? ageMaxDays : null,
    sortField,
    sortDir,
    groupBy,
  };
}

// filterToSearchParams is the inverse: it emits only the fields that differ
// from the default, so clean state produces an empty query string.
export function filterToSearchParams(filter: FindingsFilter): URLSearchParams {
  const p = new URLSearchParams();

  if (filter.query.trim()) p.set("q", filter.query.trim());
  if (filter.severities.length > 0) {
    p.set("severity", [...filter.severities].sort((a, b) => a - b).join(","));
  }
  if (filter.statuses.length > 0) {
    p.set("status", [...filter.statuses].sort((a, b) => a - b).join(","));
  }
  if (filter.kinds.length > 0) {
    p.set("kinds", [...filter.kinds].sort().join(","));
  }
  if (filter.projectIds.length > 0) {
    // Backend only accepts a single project id — emit the first one.
    p.set("project_id", filter.projectIds[0]);
  }
  if (filter.sources.length > 0) {
    p.set("sources", [...filter.sources].sort().join(","));
  }
  if (filter.ecosystems.length > 0) {
    p.set("ecosystems", [...filter.ecosystems].sort().join(","));
  }
  if (filter.iacProviders.length > 0) {
    p.set("iac_providers", [...filter.iacProviders].sort().join(","));
  }
  if (filter.secretKinds.length > 0) {
    p.set("secret_kinds", [...filter.secretKinds].sort().join(","));
  }
  if (filter.assigneeMe) p.set("assignee", "me");
  if (filter.unassigned) p.set("unassigned", "true");
  if (filter.assignees.length > 0) p.set("assignees", [...filter.assignees].sort().join(","));
  if (filter.cve.trim()) p.set("cve", filter.cve.trim());
  if (filter.component.trim()) p.set("component", filter.component.trim());
  if (filter.componentVersion.trim()) {
    p.set("component_version", filter.componentVersion.trim());
  }
  if (filter.ruleId.trim()) p.set("rule_id", filter.ruleId.trim());
  if (filter.cwe !== null) p.set("cwe", String(filter.cwe));
  if (filter.hasCVE) p.set("has_cve", "true");
  if (filter.hasFix) p.set("has_fix", "true");
  if (filter.inKEV) p.set("in_kev", "true");
  if (filter.inBDU) p.set("in_bdu", "true");
  if (filter.epssMin !== null) p.set("epss_min", String(filter.epssMin));
  if (filter.cvssMin !== null) p.set("cvss_min", String(filter.cvssMin));
  if (filter.ageMaxDays !== null) {
    p.set("age_max_days", String(filter.ageMaxDays));
  }
  if (filter.sortField !== DEFAULT_FINDINGS_FILTER.sortField) {
    p.set("sort", filter.sortField);
  }
  if (filter.sortDir !== DEFAULT_FINDINGS_FILTER.sortDir) {
    p.set("dir", filter.sortDir);
  }
  if (filter.groupBy) p.set("group_by", filter.groupBy);

  return p;
}

// buildQueryString produces the Record<string,string> payload used by the
// API hooks. It mirrors filterToSearchParams but includes cursor/limit which
// are managed by TanStack Query, not the URL.
export function buildQueryString(
  filter: FindingsFilter,
  extras: { cursor?: string | null; limit?: number } = {},
): Record<string, string> {
  const params = filterToSearchParams(filter);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  if (extras.cursor) out.cursor = extras.cursor;
  if (extras.limit !== undefined) out.limit = String(extras.limit);
  return out;
}

// Stable cache key helper for TanStack Query. Sorting arrays before
// stringifying keeps the key stable across re-renders that reorder filter
// values.
export function filterCacheKey(filter: FindingsFilter): string {
  const p = filterToSearchParams(filter);
  const entries: [string, string][] = [];
  p.forEach((v, k) => entries.push([k, v]));
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

export function isFilterEmpty(filter: FindingsFilter): boolean {
  return filterCacheKey(filter) === "";
}
