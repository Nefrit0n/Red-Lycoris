export type FindingKind =
  | "sca"
  | "sast"
  | "dast"
  | "iac"
  | "secrets"
  | "other";

export interface Finding {
  id: string;
  kind: FindingKind;
  title: string;
  description?: string;
  severity: number; // 0=info, 1=low, 2=med, 3=high, 4=crit
  confidence: number; // 0=low, 1=med, 2=high, 3=confirmed
  status: number; // 0=open, 1=confirmed, 2=fp, 3=resolved, 4=risk_accepted
  file_path?: string;
  line_start?: number;
  line_end?: number;
  component?: string;
  component_version?: string;
  cve_ids: string[];
  cwe_ids: number[];
  cpe_uri?: string;
  fingerprint: string;
  first_seen: string;
  last_seen: string;
  times_seen: number;
  project_id: string;
  source_type: string;
  fixed_version?: string;
  package_ecosystem?: string;
  purl?: string;
  code_snippet?: string;
  code_flow?: unknown;
  url?: string;
  http_method?: string;
  http_param?: string;
  http_evidence?: unknown;
  iac_resource?: string;
  iac_provider?: string;
  secret_kind?: string;
  commit_sha?: string;
  rule_id?: string;
  rule_name?: string;
  priority_score?: number;
  closure_reason_id?: number;
  closure_note?: string;
  closed_at?: string;
  closed_by?: string;
  assigned_to?: string;

  // Joined badge fields — populated only by list queries.
  in_kev?: boolean;
  in_bdu?: boolean;
  max_epss?: number;
  max_cvss?: number;
  project_name?: string;
}

export interface FindingGroup {
  group_key: string;
  group_title?: string;    // CVE description / rule_name / secret_kind
  secret_kind?: string;   // secret mode only
  ecosystem?: string;     // component mode only
  fixed_version?: string; // component mode only
  findings_count: number;
  projects_count: number;
  max_severity: number;
  first_seen: string;
  last_seen: string;
  project_ids: string[];
  sample_ids: string[];
  in_kev: boolean;
  in_bdu: boolean;
  bdu_ids?: string[];
  max_epss?: number;
  max_cvss?: number;
}

export interface FindingEvent {
  id: string;
  finding_id: string;
  user_id?: string;
  event_type:
    | "status_changed"
    | "closed"
    | "reopened"
    | "assigned"
    | "unassigned"
    | "created";
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SeverityFacet {
  severity: number;
  count: number;
}

export interface StatusFacet {
  status: number;
  count: number;
}

export interface KindFacet {
  kind: FindingKind;
  count: number;
}

export interface StringFacet {
  value: string;
  count: number;
}

export interface ProjectFacet {
  id: string;
  name: string;
  count: number;
}

export interface EnrichmentFacets {
  in_kev: number;
  has_cve: number;
  has_fix: number;
  in_bdu: number;
}

export interface FindingsFacets {
  by_severity: SeverityFacet[];
  by_status: StatusFacet[];
  by_kind: KindFacet[];
  by_source: StringFacet[];
  by_project: ProjectFacet[];
  by_ecosystem: StringFacet[];
  by_iac_provider: StringFacet[];
  by_secret_kind: StringFacet[];
  enrichment: EnrichmentFacets;
}

export interface SavedView {
  id: string;
  user_id: string;
  name: string;
  query: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon_color: string;
  source_kind: "manual" | "git" | "sarif" | "webhook";
  repo_url?: string;
  repo_provider?: "github" | "gitlab" | "bitbucket" | "other";
  default_branch?: string;
  autoscan_on_push: boolean;
  tags: string[];
  status: "active" | "paused" | "archived";
  setup_completed: boolean;
  visibility: "private" | "team" | "workspace";
  owner: {
    id: string;
    email: string;
    display_name: string;
  };
  team?: {
    id: string;
    name: string;
  };
  pinned: boolean;
  findings_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  sla_breached_count: number;
  sla_critical_days?: number;
  sla_high_days?: number;
  sla_medium_days?: number;
  sla_low_days?: number;
  sla_notify_before_days: number;
  scanners: {
    sast: "ok" | "missing" | "off";
    dast: "ok" | "missing" | "off";
    sca: "ok" | "missing" | "off";
    secrets: "ok" | "missing" | "off";
  };
  last_scan?: {
    started_at: string;
    finished_at?: string;
    status: "success" | "failed" | "running";
  };
  health: "healthy" | "warn" | "breach" | "setup" | "paused";
  created_at: string;
  updated_at: string;
}

export interface FindingScore {
  finding_id: string;
  base_score: number;
  epss_score: number;
  epss_percentile: number;
  is_kev: boolean;
  is_bdu: boolean;
  priority_score: number;
  calculated_at: string;
}

export interface FindingEnrichment {
  finding_id: string;
  source: string; // "nvd" | "epss" | "kev" | "bdu" | "osv" | "cwe"
  data: unknown;
  enriched_at: string;
}

export interface PaginatedResponse<T> {
  data: T;
  meta: {
    total: number;
    next_cursor?: string;
    has_more: boolean;
  };
}

export interface EnrichmentSourceStatus {
  source: string;
  status: "syncing" | "success" | "error" | "pending";
  last_sync_at?: string;
  records_count: number;
  duration_ms?: number;
  error_message?: string;
  next_sync_at?: string;
}

export interface EnrichmentStatusResponse {
  sources: EnrichmentSourceStatus[];
  coverage: EnrichmentCoverageStats;
}

export interface EnrichmentCoverageStats {
  total_findings: number;
  nvd: number;
  epss: number;
  kev: number;
  bdu: number;
  osv: number;
  cwe: number;
  cpe: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
