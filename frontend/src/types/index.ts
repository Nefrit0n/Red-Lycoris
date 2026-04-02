export interface Finding {
  id: string;
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
  priority_score?: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  tags: string[];
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

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
