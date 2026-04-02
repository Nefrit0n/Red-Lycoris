package storage

import (
	"context"
	"fmt"
	"time"

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

func (r *DashboardRepo) GetStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Total, open, critical+open in one query
	const countsQ = `
		SELECT
			count(*),
			count(*) FILTER (WHERE status = 0),
			count(*) FILTER (WHERE status = 0 AND severity = 4)
		FROM findings`

	err := r.pool.QueryRow(ctx, countsQ).Scan(
		&stats.TotalFindings,
		&stats.TotalOpen,
		&stats.TotalCriticalOpen,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: counts: %w", err)
	}

	// New this week
	weekAgo := time.Now().AddDate(0, 0, -7)
	const newQ = `SELECT count(*) FROM findings WHERE first_seen >= $1`
	if err := r.pool.QueryRow(ctx, newQ, weekAgo).Scan(&stats.NewThisWeek); err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: new_this_week: %w", err)
	}

	// By severity
	const sevQ = `SELECT severity, count(*) FROM findings GROUP BY severity ORDER BY severity`
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

	// By status
	const statusQ = `SELECT status, count(*) FROM findings GROUP BY status ORDER BY status`
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

	// Top-10 by priority_score
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

	// Enrichment coverage
	const enrichQ = `
		SELECT
			count(DISTINCT fe.finding_id) FILTER (WHERE fe.source = 'nvd'),
			count(DISTINCT fe.finding_id) FILTER (WHERE fe.source = 'epss'),
			count(DISTINCT fe.finding_id) FILTER (WHERE fe.source = 'kev'),
			count(DISTINCT fe.finding_id) FILTER (WHERE fe.source = 'bdu'),
			count(*)
		FROM findings f
		LEFT JOIN finding_enrichments fe ON fe.finding_id = f.id`

	var nvdCount, epssCount, kevCount, bduCount, totalForEnrich int
	err = r.pool.QueryRow(ctx, enrichQ).Scan(&nvdCount, &epssCount, &kevCount, &bduCount, &totalForEnrich)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: enrichment_coverage: %w", err)
	}

	if totalForEnrich > 0 {
		stats.EnrichmentCoverage = EnrichmentCoverage{
			NVD:  float64(nvdCount) / float64(totalForEnrich) * 100,
			EPSS: float64(epssCount) / float64(totalForEnrich) * 100,
			KEV:  float64(kevCount) / float64(totalForEnrich) * 100,
			BDU:  float64(bduCount) / float64(totalForEnrich) * 100,
		}
	}

	return stats, nil
}
