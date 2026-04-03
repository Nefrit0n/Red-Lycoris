package storage

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"vulnscope/internal/domain"
)

type DashboardRepo struct {
	pool *pgxpool.Pool
}

func NewDashboardRepo(pool *pgxpool.Pool) *DashboardRepo {
	return &DashboardRepo{pool: pool}
}

type SeverityCount struct {
	Severity int `json:"severity"`
	Count    int `json:"count"`
}

type StatusCount struct {
	Status int `json:"status"`
	Count  int `json:"count"`
}

type EnrichmentCoverage struct {
	NVD  float64 `json:"nvd"`
	EPSS float64 `json:"epss"`
	KEV  float64 `json:"kev"`
	BDU  float64 `json:"bdu"`
}

type DashboardStats struct {
	TotalFindings      int                `json:"total_findings"`
	TotalOpen          int                `json:"total_open"`
	TotalCriticalOpen  int                `json:"total_critical_open"`
	NewThisWeek        int                `json:"new_this_week"`
	BySeverity         []SeverityCount    `json:"by_severity"`
	ByStatus           []StatusCount      `json:"by_status"`
	TopFindings        []domain.Finding   `json:"top_findings"`
	EnrichmentCoverage EnrichmentCoverage `json:"enrichment_coverage"`
}

// GetStats читает статистику из materialized view dashboard_stats.
func (r *DashboardRepo) GetStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Агрегируем из materialized view dashboard_stats
	const mvQ = `
		SELECT
			COALESCE(SUM(count), 0),
			COALESCE(SUM(count) FILTER (WHERE status = 0), 0),
			COALESCE(SUM(count) FILTER (WHERE status = 0 AND severity = 4), 0),
			COALESCE(SUM(new_this_week), 0)
		FROM dashboard_stats`

	err := r.pool.QueryRow(ctx, mvQ).Scan(
		&stats.TotalFindings,
		&stats.TotalOpen,
		&stats.TotalCriticalOpen,
		&stats.NewThisWeek,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: matview counts: %w", err)
	}

	// By severity — из materialized view
	const sevQ = `
		SELECT severity, COALESCE(SUM(count), 0)
		FROM dashboard_stats
		GROUP BY severity
		ORDER BY severity`
	sevRows, err := r.pool.Query(ctx, sevQ)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: by_severity: %w", err)
	}
	defer sevRows.Close()

	for sevRows.Next() {
		var sc SeverityCount
		if err := sevRows.Scan(&sc.Severity, &sc.Count); err != nil {
			return nil, fmt.Errorf("storage.DashboardRepo.GetStats: by_severity scan: %w", err)
		}
		stats.BySeverity = append(stats.BySeverity, sc)
	}
	if err := sevRows.Err(); err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: by_severity rows: %w", err)
	}
	if stats.BySeverity == nil {
		stats.BySeverity = []SeverityCount{}
	}

	// By status — из materialized view
	const statusQ = `
		SELECT status, COALESCE(SUM(count), 0)
		FROM dashboard_stats
		GROUP BY status
		ORDER BY status`
	statusRows, err := r.pool.Query(ctx, statusQ)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: by_status: %w", err)
	}
	defer statusRows.Close()

	for statusRows.Next() {
		var sc StatusCount
		if err := statusRows.Scan(&sc.Status, &sc.Count); err != nil {
			return nil, fmt.Errorf("storage.DashboardRepo.GetStats: by_status scan: %w", err)
		}
		stats.ByStatus = append(stats.ByStatus, sc)
	}
	if err := statusRows.Err(); err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: by_status rows: %w", err)
	}
	if stats.ByStatus == nil {
		stats.ByStatus = []StatusCount{}
	}

	// Top-10 by priority_score (по-прежнему из findings, т.к. нужны полные данные)
	topQ := `SELECT ` + findingColumns + `
		FROM findings f
		LEFT JOIN finding_scores fs ON fs.finding_id = f.id
		WHERE fs.priority_score IS NOT NULL
		ORDER BY fs.priority_score DESC, f.id
		LIMIT 10`

	topRows, err := r.pool.Query(ctx, topQ)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: top_findings: %w", err)
	}
	defer topRows.Close()

	for topRows.Next() {
		var f domain.Finding
		err := topRows.Scan(
			&f.ID, &f.Title, &f.Description, &f.Severity, &f.Confidence, &f.Status,
			&f.FilePath, &f.LineStart, &f.LineEnd, &f.Component, &f.ComponentVersion,
			&f.CVEIDs, &f.CWEIDs, &f.CPEURI, &f.Fingerprint, &f.FirstSeen, &f.LastSeen,
			&f.TimesSeen, &f.ProjectID, &f.SourceType, &f.PriorityScore,
		)
		if err != nil {
			return nil, fmt.Errorf("storage.DashboardRepo.GetStats: top_findings scan: %w", err)
		}
		if f.CVEIDs == nil {
			f.CVEIDs = []string{}
		}
		if f.CWEIDs == nil {
			f.CWEIDs = []int{}
		}
		stats.TopFindings = append(stats.TopFindings, f)
	}
	if err := topRows.Err(); err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: top_findings rows: %w", err)
	}
	if stats.TopFindings == nil {
		stats.TopFindings = []domain.Finding{}
	}

	// Enrichment coverage — из materialized view enrichment_coverage
	const enrichQ = `
		SELECT source, enriched_count, total_findings
		FROM enrichment_coverage`

	enrichRows, err := r.pool.Query(ctx, enrichQ)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: enrichment_coverage: %w", err)
	}
	defer enrichRows.Close()

	var totalFindings int
	sourceCounts := make(map[string]int)
	for enrichRows.Next() {
		var source string
		var enrichedCount, tf int
		if err := enrichRows.Scan(&source, &enrichedCount, &tf); err != nil {
			return nil, fmt.Errorf("storage.DashboardRepo.GetStats: enrichment_coverage scan: %w", err)
		}
		sourceCounts[source] = enrichedCount
		totalFindings = tf
	}
	if err := enrichRows.Err(); err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: enrichment_coverage rows: %w", err)
	}

	if totalFindings > 0 {
		stats.EnrichmentCoverage = EnrichmentCoverage{
			NVD:  float64(sourceCounts["nvd"]) / float64(totalFindings) * 100,
			EPSS: float64(sourceCounts["epss"]) / float64(totalFindings) * 100,
			KEV:  float64(sourceCounts["kev"]) / float64(totalFindings) * 100,
			BDU:  float64(sourceCounts["bdu"]) / float64(totalFindings) * 100,
		}
	}

	return stats, nil
}
