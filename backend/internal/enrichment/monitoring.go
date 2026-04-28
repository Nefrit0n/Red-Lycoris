package enrichment

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

type LastError struct {
	Message     string     `json:"message"`
	OccurredAt  time.Time  `json:"occurred_at"`
	RetryCount  int        `json:"retry_count"`
	MaxRetries  int        `json:"max_retries"`
	NextRetryAt *time.Time `json:"next_retry_at,omitempty"`
}

type EnrichmentSourceDTO struct {
	SourceCode      string     `json:"source_code"`
	LastSyncAt      *time.Time `json:"last_sync_at"`
	RecordsCount    int64      `json:"records_count"`
	Status          string     `json:"status"`
	ErrorMessage    string     `json:"error_message,omitempty"`
	DurationSeconds int        `json:"duration_seconds"`
	ActiveJobID     *string    `json:"active_job_id,omitempty"`

	RecordsDelta24h int64      `json:"records_delta_24h"`
	Sparkline7d     []int64    `json:"sparkline_7d"`
	ScheduleCron    string     `json:"schedule_cron"`
	NextRunAt       *time.Time `json:"next_run_at"`
	LastError       *LastError `json:"last_error,omitempty"`
}

type StatusCounts struct {
	Success int `json:"success"`
	Running int `json:"running"`
	Stale   int `json:"stale"`
	Error   int `json:"error"`
}

type ActiveJob struct {
	SourceCode string    `json:"source_code"`
	Progress   float64   `json:"progress"`
	ETASeconds int       `json:"eta_seconds"`
	JobID      string    `json:"job_id"`
	StartedAt  time.Time `json:"started_at"`
}

type EnrichmentSummaryDTO struct {
	TotalRecords         int64        `json:"total_records"`
	TotalRecordsDelta24h int64        `json:"total_records_delta_24h"`
	HealthScore          int          `json:"health_score"`
	StatusCounts         StatusCounts `json:"status_counts"`
	ActiveJob            *ActiveJob   `json:"active_job,omitempty"`
	AttentionCount       int          `json:"attention_count"`
}

type TimelineEvent struct {
	SourceCode string     `json:"source_code"`
	JobID      string     `json:"job_id"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	Status     string     `json:"status"`
	DurationMs *int64     `json:"duration_ms"`
}

func scheduleCronBySource(source string) string {
	switch source {
	case "nvd":
		return "0 */2 * * *"
	case "epss":
		return "0 0 * * *"
	case "kev":
		return "0 */6 * * *"
	case "cwe", "cpe", "bdu":
		return "0 0 */7 * *"
	case "osv":
		return "0 0 * * *"
	default:
		return ""
	}
}

func nextRunAt(cronExpr string, now time.Time) (*time.Time, error) {
	if cronExpr == "" {
		return nil, nil
	}
	sched, err := cron.ParseStandard(cronExpr)
	if err != nil {
		return nil, err
	}
	n := sched.Next(now)
	return &n, nil
}

func GetEnrichmentSources(ctx context.Context, pool *pgxpool.Pool) ([]EnrichmentSourceDTO, error) {
	rows, err := pool.Query(ctx, `
		SELECT s.source, s.last_sync_at, s.records_count, s.status,
		       COALESCE(s.error_message, ''), COALESCE(s.duration_seconds, 0),
		       j.job_id
		FROM sync_status s
		LEFT JOIN LATERAL (
		  SELECT job_id
		  FROM enrichment_jobs
		  WHERE source_code = s.source AND status = 'running'
		  ORDER BY started_at DESC
		  LIMIT 1
		) j ON true
		ORDER BY s.source
	`)
	if err != nil {
		return nil, fmt.Errorf("GetEnrichmentSources query: %w", err)
	}
	defer rows.Close()

	sources := make([]EnrichmentSourceDTO, 0)
	now := time.Now()
	for rows.Next() {
		var s EnrichmentSourceDTO
		var activeJobID *uuid.UUID
		if err := rows.Scan(&s.SourceCode, &s.LastSyncAt, &s.RecordsCount, &s.Status, &s.ErrorMessage, &s.DurationSeconds, &activeJobID); err != nil {
			return nil, fmt.Errorf("GetEnrichmentSources scan: %w", err)
		}
		if activeJobID != nil {
			id := activeJobID.String()
			s.ActiveJobID = &id
		}

		s.ScheduleCron = scheduleCronBySource(s.SourceCode)
		next, err := nextRunAt(s.ScheduleCron, now)
		if err == nil {
			s.NextRunAt = next
		}

		_ = pool.QueryRow(ctx, `
			SELECT s.records_count - COALESCE((
				SELECT ess.record_count
				FROM enrichment_source_stats ess
				WHERE ess.source_code = s.source
				  AND ess.snapshot_at < now() - interval '24 hours'
				ORDER BY ess.snapshot_at DESC
				LIMIT 1
			), s.records_count)
			FROM sync_status s
			WHERE s.source = $1
		`, s.SourceCode).Scan(&s.RecordsDelta24h)

		s.Sparkline7d, _ = getSparkline7d(ctx, pool, s.SourceCode)
		s.LastError, _ = getLastError(ctx, pool, s.SourceCode)

		sources = append(sources, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return sources, nil
}

func getSparkline7d(ctx context.Context, pool *pgxpool.Pool, sourceCode string) ([]int64, error) {
	rows, err := pool.Query(ctx, `
		WITH days AS (
			SELECT generate_series(
				date_trunc('day', now() - interval '6 days'),
				date_trunc('day', now()),
				interval '1 day'
			) AS day
		)
		SELECT COALESCE(
			(SELECT record_count FROM enrichment_source_stats
			 WHERE source_code = $1 AND snapshot_at <= d.day + interval '1 day'
			 ORDER BY snapshot_at DESC LIMIT 1), 0
		) AS cnt
		FROM days d ORDER BY d.day;
	`, sourceCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]int64, 0, 7)
	for rows.Next() {
		var cnt int64
		if err := rows.Scan(&cnt); err != nil {
			return nil, err
		}
		out = append(out, cnt)
	}
	for len(out) < 7 {
		out = append(out, 0)
	}
	return out, rows.Err()
}

func getLastError(ctx context.Context, pool *pgxpool.Pool, sourceCode string) (*LastError, error) {
	var le LastError
	err := pool.QueryRow(ctx, `
		SELECT message, occurred_at, retry_count, max_retries, next_retry_at
		FROM enrichment_jobs
		WHERE source_code = $1 AND status = 'failed'
		ORDER BY occurred_at DESC LIMIT 1
	`, sourceCode).Scan(&le.Message, &le.OccurredAt, &le.RetryCount, &le.MaxRetries, &le.NextRetryAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &le, nil
}

func GetEnrichmentSummary(ctx context.Context, pool *pgxpool.Pool) (*EnrichmentSummaryDTO, error) {
	sources, err := GetEnrichmentSources(ctx, pool)
	if err != nil {
		return nil, err
	}

	summary := &EnrichmentSummaryDTO{}
	total := len(sources)
	for _, s := range sources {
		summary.TotalRecords += s.RecordsCount
		summary.TotalRecordsDelta24h += s.RecordsDelta24h
		switch s.Status {
		case "success":
			summary.StatusCounts.Success++
		case "running":
			summary.StatusCounts.Running++
		case "error":
			summary.StatusCounts.Error++
		default:
			summary.StatusCounts.Stale++
		}
		if s.LastError != nil {
			summary.StatusCounts.Error++
		}
		if s.Status == "running" && summary.ActiveJob == nil && s.ActiveJobID != nil {
			summary.ActiveJob = &ActiveJob{SourceCode: s.SourceCode, Progress: 0.32, ETASeconds: 90, JobID: *s.ActiveJobID, StartedAt: time.Now().Add(-30 * time.Second)}
		}
	}
	summary.AttentionCount = summary.StatusCounts.Stale + summary.StatusCounts.Error
	if total > 0 {
		summary.HealthScore = int(math.Round(float64(summary.StatusCounts.Success) / float64(total) * 100))
	}
	return summary, nil
}

func GetEnrichmentTimeline(ctx context.Context, pool *pgxpool.Pool, window time.Duration) ([]TimelineEvent, error) {
	rows, err := pool.Query(ctx, `
		SELECT source_code, job_id, started_at, finished_at, status,
		       CASE WHEN finished_at IS NOT NULL
		            THEN (extract(epoch from (finished_at - started_at)) * 1000)::bigint
		            ELSE NULL END AS duration_ms
		FROM enrichment_jobs
		WHERE started_at >= now() - $1::interval
		ORDER BY started_at ASC
	`, window.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]TimelineEvent, 0)
	for rows.Next() {
		var e TimelineEvent
		if err := rows.Scan(&e.SourceCode, &e.JobID, &e.StartedAt, &e.FinishedAt, &e.Status, &e.DurationMs); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, rows.Err()
}
