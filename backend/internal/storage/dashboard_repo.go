package storage

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type DashboardRepo struct {
	pool *pgxpool.Pool
}

type DashboardFilter struct {
	AccessibleProjectIDs []uuid.UUID
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

func buildProjectScope(alias string, accessibleProjectIDs []uuid.UUID, argPos int) (string, []any, int) {
	if accessibleProjectIDs == nil {
		return "", nil, argPos
	}
	if len(accessibleProjectIDs) == 0 {
		return " WHERE 1 = 0", nil, argPos
	}
	return fmt.Sprintf(" WHERE %s.project_id = ANY($%d)", alias, argPos), []any{accessibleProjectIDs}, argPos + 1
}

// GetStats reads aggregated dashboard stats with optional project access filter.
func (r *DashboardRepo) GetStats(ctx context.Context, filter DashboardFilter) (*DashboardStats, error) {
	stats := &DashboardStats{}
	scopeWhere, scopeArgs, _ := buildProjectScope("f", filter.AccessibleProjectIDs, 1)

	countQ := `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE f.status = 0),
			COUNT(*) FILTER (WHERE f.status = 0 AND f.severity = 4),
			COUNT(*) FILTER (WHERE f.first_seen > now() - interval '7 days')
		FROM findings f` + scopeWhere

	err := r.pool.QueryRow(ctx, countQ, scopeArgs...).Scan(
		&stats.TotalFindings,
		&stats.TotalOpen,
		&stats.TotalCriticalOpen,
		&stats.NewThisWeek,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: matview counts: %w", err)
	}

	sevQ := `
		SELECT f.severity, COUNT(*)
		FROM findings f` + scopeWhere + `
		GROUP BY f.severity
		ORDER BY f.severity`
	sevRows, err := r.pool.Query(ctx, sevQ, scopeArgs...)
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

	statusQ := `
		SELECT f.status, COUNT(*)
		FROM findings f` + scopeWhere + `
		GROUP BY f.status
		ORDER BY f.status`
	statusRows, err := r.pool.Query(ctx, statusQ, scopeArgs...)
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

	topQ := `SELECT ` + findingColumns + `
		FROM findings f
		LEFT JOIN finding_scores fs ON fs.finding_id = f.id
		WHERE fs.priority_score IS NOT NULL`
	if scopeWhere != "" {
		topQ += " AND " + scopeWhere[len(" WHERE "):]
	}
	topQ += `
		ORDER BY fs.priority_score DESC, f.id
		LIMIT 10`

	topRows, err := r.pool.Query(ctx, topQ, scopeArgs...)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: top_findings: %w", err)
	}
	defer topRows.Close()

	for topRows.Next() {
		f, err := scanFinding(topRows)
		if err != nil {
			return nil, fmt.Errorf("storage.DashboardRepo.GetStats: top_findings scan: %w", err)
		}
		stats.TopFindings = append(stats.TopFindings, *f)
	}
	if err := topRows.Err(); err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: top_findings rows: %w", err)
	}
	if stats.TopFindings == nil {
		stats.TopFindings = []domain.Finding{}
	}

	enrichQ := `
		SELECT fe.source, COUNT(DISTINCT fe.finding_id)
		FROM finding_enrichments fe
		JOIN findings f ON f.id = fe.finding_id` + scopeWhere + `
		GROUP BY fe.source`
	enrichRows, err := r.pool.Query(ctx, enrichQ, scopeArgs...)
	if err != nil {
		return nil, fmt.Errorf("storage.DashboardRepo.GetStats: enrichment_coverage: %w", err)
	}
	defer enrichRows.Close()

	totalFindings := stats.TotalFindings
	sourceCounts := make(map[string]int)
	for enrichRows.Next() {
		var source string
		var enrichedCount int
		if err := enrichRows.Scan(&source, &enrichedCount); err != nil {
			return nil, fmt.Errorf("storage.DashboardRepo.GetStats: enrichment_coverage scan: %w", err)
		}
		sourceCounts[source] = enrichedCount
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
