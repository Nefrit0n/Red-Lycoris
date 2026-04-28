export interface LastError {
  message: string;
  occurred_at: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string | null;
}

export interface EnrichmentSourceDTO {
  source_code: string;
  last_sync_at: string | null;
  records_count: number;
  status: string;
  error_message?: string;
  duration_seconds: number;
  active_job_id?: string;
  records_delta_24h: number;
  sparkline_7d: number[];
  schedule_cron: string;
  next_run_at: string | null;
  last_error?: LastError | null;
}

export interface StatusCounts {
  success: number;
  running: number;
  stale: number;
  error: number;
}

export interface ActiveJob {
  source_code: string;
  progress: number;
  eta_seconds: number;
  job_id: string;
  started_at: string;
}

export interface EnrichmentSummaryDTO {
  total_records: number;
  total_records_delta_24h: number;
  health_score: number;
  status_counts: StatusCounts;
  active_job?: ActiveJob | null;
  attention_count: number;
}

export interface TimelineEvent {
  source_code: string;
  job_id: string;
  started_at: string;
  finished_at: string | null;
  status: "success" | "running" | "failed";
  duration_ms: number | null;
}
