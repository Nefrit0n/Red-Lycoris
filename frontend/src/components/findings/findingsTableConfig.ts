import type { FindingKind } from "@/types";

export type FindingsTabKey = FindingKind | "all";

export type ColumnKey =
  | "checkbox"
  | "type"
  | "name"
  | "component"
  | "file"
  | "rule"
  | "secret_kind"
  | "fix"
  | "enrichment"
  | "cve"
  | "cwe"
  | "bdu"
  | "kev"
  | "cvss"
  | "epss"
  | "severity"
  | "project"
  | "detected"
  | "status"
  | "first_seen"
  | "last_seen";

export type FindingsPreset = "triage" | "engineering" | "compliance" | "full" | "custom";

export const REQUIRED_COLUMNS: ColumnKey[] = ["checkbox", "type", "name"];

export const COLUMN_WIDTH: Record<ColumnKey, string> = {
  checkbox: "w-[40px] shrink-0",
  type: "w-[32px] shrink-0",
  name: "w-[360px] shrink-0",
  component: "w-[240px] shrink-0",
  file: "w-[240px] shrink-0",
  rule: "w-[200px] shrink-0",
  secret_kind: "w-[120px] shrink-0",
  fix: "w-[160px] shrink-0",
  enrichment: "w-[320px] shrink-0",
  cve: "w-[180px] shrink-0",
  cwe: "w-[130px] shrink-0",
  bdu: "w-[100px] shrink-0",
  kev: "w-[100px] shrink-0",
  cvss: "w-[90px] shrink-0",
  epss: "w-[100px] shrink-0",
  severity: "w-[120px] shrink-0",
  project: "w-[140px] shrink-0",
  detected: "w-[100px] shrink-0",
  status: "w-[130px] shrink-0",
  first_seen: "w-[140px] shrink-0",
  last_seen: "w-[140px] shrink-0",
};

export const COLUMN_WIDTH_PX: Record<ColumnKey, number> = {
  checkbox: 40,
  type: 32,
  name: 360,
  component: 240,
  file: 240,
  rule: 200,
  secret_kind: 120,
  fix: 160,
  enrichment: 320,
  cve: 180,
  cwe: 130,
  bdu: 100,
  kev: 100,
  cvss: 90,
  epss: 100,
  severity: 120,
  project: 140,
  detected: 100,
  status: 130,
  first_seen: 140,
  last_seen: 140,
};

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  checkbox: "Checkbox",
  type: "Тип",
  name: "Название",
  component: "Компонент",
  file: "Файл",
  rule: "Правило",
  secret_kind: "Тип секрета",
  fix: "Фикс",
  enrichment: "Обогащение",
  cve: "CVE",
  cwe: "CWE",
  bdu: "БДУ",
  kev: "KEV",
  cvss: "CVSS",
  epss: "EPSS",
  severity: "Критичность",
  project: "Проект",
  detected: "Обнаружено",
  status: "Статус",
  first_seen: "Первое замечено",
  last_seen: "Последнее замечено",
};

export const PRESET_LABEL: Record<FindingsPreset, string> = {
  triage: "Triage",
  engineering: "Engineering",
  compliance: "Compliance",
  full: "Full",
  custom: "Custom",
};

const COMMON_TRIAGE: ColumnKey[] = ["checkbox", "type", "name", "project", "detected"];

const TAB_AVAILABLE_COLUMNS: Record<FindingsTabKey, ColumnKey[]> = {
  all: ["checkbox", "type", "name", "enrichment", "project", "detected", "severity", "status"],
  sca: ["checkbox", "type", "name", "component", "fix", "enrichment", "cve", "cwe", "bdu", "kev", "cvss", "epss", "severity", "project", "detected", "status", "first_seen", "last_seen"],
  sast: ["checkbox", "type", "name", "rule", "file", "enrichment", "cve", "cwe", "bdu", "kev", "cvss", "epss", "severity", "project", "detected", "status", "first_seen", "last_seen"],
  dast: ["checkbox", "type", "name", "file", "enrichment", "cve", "cwe", "bdu", "kev", "cvss", "epss", "severity", "project", "detected", "status", "first_seen", "last_seen"],
  iac: ["checkbox", "type", "name", "file", "enrichment", "cve", "cwe", "bdu", "kev", "cvss", "epss", "severity", "project", "detected", "status", "first_seen", "last_seen"],
  secrets: ["checkbox", "type", "name", "secret_kind", "file", "project", "detected", "severity", "status", "first_seen", "last_seen"],
  other: ["checkbox", "type", "name", "enrichment", "project", "detected", "severity", "status", "first_seen", "last_seen"],
};

const PRESETS: Record<FindingsTabKey, Record<Exclude<FindingsPreset, "custom">, ColumnKey[]>> = {
  all: {
    triage: ["checkbox", "type", "name", "enrichment", "project", "detected"],
    engineering: ["checkbox", "type", "name", "project", "status"],
    compliance: ["checkbox", "type", "name", "cve", "cwe", "bdu", "severity", "project", "detected"],
    full: ["checkbox", "type", "name", "enrichment", "severity", "project", "detected", "status"],
  },
  sca: {
    triage: ["checkbox", "type", "name", "enrichment", "project", "detected"],
    engineering: ["checkbox", "type", "name", "component", "fix", "project"],
    compliance: ["checkbox", "type", "name", "cve", "cwe", "bdu", "severity", "project", "detected"],
    full: ["checkbox", "type", "name", "component", "fix", "enrichment", "project", "detected"],
  },
  sast: {
    triage: ["checkbox", "type", "name", "rule", "file", "enrichment", "project", "detected"],
    engineering: ["checkbox", "type", "name", "rule", "file", "project", "status"],
    compliance: ["checkbox", "type", "name", "cve", "cwe", "bdu", "severity", "project", "detected"],
    full: ["checkbox", "type", "name", "rule", "file", "enrichment", "project", "detected"],
  },
  dast: {
    triage: ["checkbox", "type", "name", "file", "enrichment", "project", "detected"],
    engineering: ["checkbox", "type", "name", "file", "project", "status"],
    compliance: ["checkbox", "type", "name", "cve", "cwe", "bdu", "severity", "project", "detected"],
    full: ["checkbox", "type", "name", "file", "enrichment", "project", "detected"],
  },
  iac: {
    triage: ["checkbox", "type", "name", "file", "enrichment", "project", "detected"],
    engineering: ["checkbox", "type", "name", "file", "project", "status"],
    compliance: ["checkbox", "type", "name", "cve", "cwe", "bdu", "severity", "project", "detected"],
    full: ["checkbox", "type", "name", "file", "enrichment", "project", "detected"],
  },
  secrets: {
    triage: ["checkbox", "type", "name", "secret_kind", "file", "project", "detected"],
    engineering: ["checkbox", "type", "name", "secret_kind", "file", "project", "status"],
    compliance: ["checkbox", "type", "name", "severity", "project", "detected", "status"],
    full: ["checkbox", "type", "name", "secret_kind", "file", "project", "detected", "status"],
  },
  other: {
    triage: [...COMMON_TRIAGE],
    engineering: ["checkbox", "type", "name", "project", "status"],
    compliance: ["checkbox", "type", "name", "severity", "project", "detected"],
    full: ["checkbox", "type", "name", "enrichment", "project", "detected", "status"],
  },
};

export function rowHeightForPreset(preset: FindingsPreset): number {
  if (preset === "triage") return 44;
  if (preset === "engineering") return 48;
  return 44;
}

export function availableColumnsForTab(tab: FindingsTabKey): ColumnKey[] {
  return TAB_AVAILABLE_COLUMNS[tab];
}

export function presetColumns(tab: FindingsTabKey, preset: Exclude<FindingsPreset, "custom">): ColumnKey[] {
  return PRESETS[tab][preset];
}

export function sanitizeColumns(tab: FindingsTabKey, columns: ColumnKey[]): ColumnKey[] {
  const allowed = new Set(availableColumnsForTab(tab));
  const kept = columns.filter((key, i) => allowed.has(key) && columns.indexOf(key) === i);
  for (const required of REQUIRED_COLUMNS) {
    if (allowed.has(required) && !kept.includes(required)) kept.unshift(required);
  }
  return kept.length > 0 ? kept : presetColumns(tab, "triage");
}
