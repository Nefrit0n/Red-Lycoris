package enrichment

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
	"redlycoris/internal/domain/cvss"
	"redlycoris/internal/domain/epss"
	nvdrefs "redlycoris/internal/enrichment/nvd"
)

// EnrichFinding обогащает один finding из локальных справочных таблиц.
// Записывает данные в finding_enrichments и вычисляет priority_score в finding_scores.
func EnrichFinding(ctx context.Context, pool *pgxpool.Pool, findingID uuid.UUID) error {
	// Загружаем finding
	var f struct {
		CVEIDs           []string
		CWEIDs           []int
		Component        string
		ComponentVersion string
		FirstSeen        time.Time
	}
	err := pool.QueryRow(ctx, `
		SELECT cve_ids, cwe_ids, component, component_version, first_seen
		FROM findings WHERE id = $1
	`, findingID).Scan(&f.CVEIDs, &f.CWEIDs, &f.Component, &f.ComponentVersion, &f.FirstSeen)
	if err != nil {
		return fmt.Errorf("enrichment.EnrichFinding: load finding: %w", err)
	}

	var baseScore float64
	var epssScore, epssPercentile float64
	var epssTrend7d float64
	var isKEV, isBDU bool

	// a) NVD — по CVE IDs
	if len(f.CVEIDs) > 0 {
		rows, err := pool.Query(ctx, `
			SELECT cve_id, description,
			       cvss_v31_score, cvss_v31_vector,
			       cvss_v40_score, cvss_v40_vector,
			       cvss_v2_score, cvss_v2_vector,
			       cwe_ids, cpe_matches, "references",
			       published_at, modified_at
			FROM nvd_cves WHERE cve_id = ANY($1)
		`, f.CVEIDs)
		if err == nil {
			var nvdEntries []map[string]any
			for rows.Next() {
				var cveID, desc string
				var v31Score, v40Score, v2Score *float32
				var v31Vec, v40Vec, v2Vec *string
				var cweIDs []int32
				var cpeMatchesRaw, referencesRaw []byte
				var publishedAt, modifiedAt *time.Time
				if err := rows.Scan(
					&cveID, &desc,
					&v31Score, &v31Vec,
					&v40Score, &v40Vec,
					&v2Score, &v2Vec,
					&cweIDs, &cpeMatchesRaw, &referencesRaw,
					&publishedAt, &modifiedAt,
				); err != nil {
					continue
				}
				entry := map[string]any{
					"cve_id":      cveID,
					"description": desc,
				}

				if v40Score != nil {
					item := map[string]any{"score": *v40Score, "vector": safeStr(v40Vec)}
					if v40Vec != nil {
						if metrics, err := cvss.ParseV40(*v40Vec); err == nil {
							item["metrics"] = metrics
						}
					}
					entry["cvss_v40"] = item
				}

				if v31Score != nil {
					item := map[string]any{"score": *v31Score, "vector": safeStr(v31Vec)}
					if v31Vec != nil {
						if metrics, err := cvss.ParseV31(*v31Vec); err == nil {
							item["metrics"] = metrics
						}
					}
					entry["cvss_v31"] = item
				}

				if v2Score != nil {
					item := map[string]any{"score": *v2Score, "vector": safeStr(v2Vec)}
					if v2Vec != nil {
						if metrics, err := cvss.ParseV2(*v2Vec); err == nil {
							item["metrics"] = metrics
						}
					}
					entry["cvss_v2"] = item
				}

				if len(cweIDs) > 0 {
					entry["cwe_ids"] = cweIDs
				}
				if len(cpeMatchesRaw) > 0 {
					entry["cpe_matches"] = json.RawMessage(cpeMatchesRaw)
				}
				entry["cpe_match"] = nvdrefs.MatchCPE(f.Component, f.ComponentVersion, cpeMatchesRaw)
				if len(referencesRaw) > 0 {
					if refs := nvdrefs.ClassifyReferences(referencesRaw); refs != nil {
						entry["references"] = refs
					}
				}
				if publishedAt != nil {
					entry["published_at"] = publishedAt
				}
				if modifiedAt != nil {
					entry["modified_at"] = modifiedAt
				}

				if v40Score != nil {
					baseScore = float64(*v40Score)
				} else if v31Score != nil {
					baseScore = float64(*v31Score)
				} else if v2Score != nil {
					baseScore = float64(*v2Score)
				}

				nvdEntries = append(nvdEntries, entry)
			}
			rows.Close()
			if len(nvdEntries) > 0 {
				saveEnrichment(ctx, pool, findingID, "nvd", nvdEntries)
			}
		}

		// b) EPSS — по CVE IDs, с историей
		currentRows, err := pool.Query(ctx, `
			SELECT cve_id, epss_score, percentile, score_date
			FROM epss_scores WHERE cve_id = ANY($1)
		`, f.CVEIDs)
		if err == nil {
			var epssEntries []map[string]any
			var maxCurrentScore float64

			for currentRows.Next() {
				var cveID string
				var scoreF, pctF float32
				var scoreDate time.Time
				if err := currentRows.Scan(&cveID, &scoreF, &pctF, &scoreDate); err != nil {
					continue
				}
				score := float64(scoreF)
				pct := float64(pctF)

				histRows, herr := pool.Query(ctx, `
					SELECT score_date, epss_score, percentile
					FROM epss_history
					WHERE cve_id = $1
					  AND score_date >= CURRENT_DATE - INTERVAL '90 days'
					ORDER BY score_date ASC
				`, cveID)

				var history []epss.HistoryPoint
				if herr == nil {
					for histRows.Next() {
						var d time.Time
						var s, p float32
						if err := histRows.Scan(&d, &s, &p); err == nil {
							history = append(history, epss.HistoryPoint{
								Date:       d,
								Score:      float64(s),
								Percentile: float64(p),
							})
						}
					}
					histRows.Close()
				}

				trend := epss.ComputeTrend(history)
				tier := epss.ScoreTier(score)

				entry := map[string]any{
					"cve_id":     cveID,
					"epss_score": score,
					"percentile": pct,
					"score_date": scoreDate,
					"tier":       string(tier),
					"trend_7d":   trend.Trend7d,
					"trend_30d":  trend.Trend30d,
					"peak_90d":   trend.Peak90d,
					"is_rising":  trend.IsRising,
				}
				if len(history) > 0 {
					entry["history"] = history
				}

				epssEntries = append(epssEntries, entry)

				if score > maxCurrentScore {
					maxCurrentScore = score
					epssScore = score
					epssPercentile = pct
					epssTrend7d = trend.Trend7d
				}
			}
			currentRows.Close()
			if len(epssEntries) > 0 {
				saveEnrichment(ctx, pool, findingID, "epss", epssEntries)
			}

			_ = maxCurrentScore
		}

		// c) KEV — по CVE IDs
		rows, err = pool.Query(ctx, `
			SELECT cve_id, vendor, product, vulnerability_name, date_added, known_ransomware
			FROM kev_catalog WHERE cve_id = ANY($1)
		`, f.CVEIDs)
		if err == nil {
			var kevEntries []map[string]any
			for rows.Next() {
				var cveID, vendor, product, vulnName string
				var dateAdded *time.Time
				var ransomware bool
				if err := rows.Scan(&cveID, &vendor, &product, &vulnName, &dateAdded, &ransomware); err != nil {
					continue
				}
				kevEntries = append(kevEntries, map[string]any{
					"cve_id": cveID, "vendor": vendor, "product": product,
					"vulnerability_name": vulnName, "known_ransomware": ransomware,
				})
				isKEV = true
			}
			rows.Close()
			if len(kevEntries) > 0 {
				saveEnrichment(ctx, pool, findingID, "kev", kevEntries)
			}
		}

		// d) BDU — по CVE IDs (cve_ids @> ARRAY[cve])
		for _, cveID := range f.CVEIDs {
			rows, err = pool.Query(ctx, `
				SELECT bdu_id, name, severity, cvss_v3_score
				FROM bdu_fstec WHERE cve_ids @> ARRAY[$1]::text[]
			`, cveID)
			if err == nil {
				for rows.Next() {
					var bduID, name, severity string
					var cvssScore *float32
					if err := rows.Scan(&bduID, &name, &severity, &cvssScore); err != nil {
						continue
					}
					saveEnrichment(ctx, pool, findingID, "bdu", map[string]any{
						"bdu_id": bduID, "name": name, "severity": severity,
						"cve_id": cveID,
					})
					isBDU = true
				}
				rows.Close()
			}
		}
	}

	// e) OSV — по component+version
	if f.Component != "" {
		ecosystem := guessEcosystem(f.Component)
		if ecosystem != "" {
			rows, err := pool.Query(ctx, `
				SELECT osv_id, summary, aliases, severity
				FROM osv_vulnerabilities
				WHERE ecosystem = $1 AND package_name = $2
				LIMIT 50
			`, ecosystem, f.Component)
			if err == nil {
				var osvEntries []map[string]any
				for rows.Next() {
					var osvID, summary string
					var aliases []string
					var severity json.RawMessage
					if err := rows.Scan(&osvID, &summary, &aliases, &severity); err != nil {
						continue
					}
					osvEntries = append(osvEntries, map[string]any{
						"osv_id": osvID, "summary": summary, "aliases": aliases,
					})
				}
				rows.Close()
				if len(osvEntries) > 0 {
					saveEnrichment(ctx, pool, findingID, "osv", osvEntries)
				}
			}
		}
	}

	// f) CWE — по CWE IDs
	if len(f.CWEIDs) > 0 {
		rows, err := pool.Query(ctx, `
			SELECT cwe_id, name, description, likelihood, impact
			FROM cwe_catalog WHERE cwe_id = ANY($1)
		`, f.CWEIDs)
		if err == nil {
			var cweEntries []map[string]any
			for rows.Next() {
				var cweID int
				var name, desc, likelihood, impact string
				if err := rows.Scan(&cweID, &name, &desc, &likelihood, &impact); err != nil {
					continue
				}
				cweEntries = append(cweEntries, map[string]any{
					"cwe_id": cweID, "name": name, "description": desc,
					"likelihood": likelihood, "impact": impact,
				})
			}
			rows.Close()
			if len(cweEntries) > 0 {
				saveEnrichment(ctx, pool, findingID, "cwe", cweEntries)
			}
		}
	}

	// g) Вычисляем priority_score
	daysOld := math.Max(0, time.Since(f.FirstSeen).Hours()/24)
	priorityScore := domain.CalculatePriorityScore(baseScore, epssScore, epssTrend7d, isKEV, isBDU, daysOld)

	_, err = pool.Exec(ctx, `
		INSERT INTO finding_scores (finding_id, base_score, epss_score, epss_percentile,
		                            is_kev, is_bdu, priority_score, calculated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		ON CONFLICT (finding_id) DO UPDATE
		SET base_score      = EXCLUDED.base_score,
		    epss_score      = EXCLUDED.epss_score,
		    epss_percentile = EXCLUDED.epss_percentile,
		    is_kev          = EXCLUDED.is_kev,
		    is_bdu          = EXCLUDED.is_bdu,
		    priority_score  = EXCLUDED.priority_score,
		    calculated_at   = now()
	`, findingID, baseScore, epssScore, epssPercentile, isKEV, isBDU, priorityScore)
	if err != nil {
		return fmt.Errorf("enrichment.EnrichFinding: save score: %w", err)
	}

	slog.Debug("finding enriched", "finding_id", findingID, "priority_score", priorityScore)
	return nil
}

// EnrichBatch обогащает пачку findings.
func EnrichBatch(ctx context.Context, pool *pgxpool.Pool, findingIDs []uuid.UUID) (enriched, failed int) {
	for _, id := range findingIDs {
		if err := EnrichFinding(ctx, pool, id); err != nil {
			slog.Error("enrich finding failed", "finding_id", id, "error", err)
			failed++
		} else {
			enriched++
		}
	}
	return enriched, failed
}

func saveEnrichment(ctx context.Context, pool *pgxpool.Pool, findingID uuid.UUID, source string, data any) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		slog.Error("failed to marshal enrichment data", "source", source, "error", err)
		return
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO finding_enrichments (finding_id, source, data, enriched_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (finding_id, source) DO UPDATE
		SET data = EXCLUDED.data, enriched_at = now()
	`, findingID, source, jsonData)
	if err != nil {
		slog.Error("failed to save enrichment", "finding_id", findingID, "source", source, "error", err)
	}
}

func safeStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// guessEcosystem пытается определить экосистему по имени компонента.
func guessEcosystem(component string) string {
	// Простая эвристика по паттернам имён пакетов
	switch {
	case contains(component, "/") && !contains(component, ":"):
		// "github.com/foo/bar" → Go, "lodash" without slash → could be npm
		if contains(component, ".") {
			return "Go"
		}
		return "npm"
	case contains(component, ":"):
		// "org.apache:commons" → Maven
		return "Maven"
	default:
		return ""
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && containsImpl(s, sub)
}

func containsImpl(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// GetFindingEnrichments возвращает все enrichments для finding.
func GetFindingEnrichments(ctx context.Context, pool *pgxpool.Pool, findingID uuid.UUID) ([]domain.FindingEnrichment, error) {
	rows, err := pool.Query(ctx, `
		SELECT finding_id, source, data, enriched_at
		FROM finding_enrichments
		WHERE finding_id = $1
		ORDER BY source
	`, findingID)
	if err != nil {
		return nil, fmt.Errorf("enrichment.GetFindingEnrichments: %w", err)
	}
	defer rows.Close()

	var enrichments []domain.FindingEnrichment
	for rows.Next() {
		var e domain.FindingEnrichment
		if err := rows.Scan(&e.FindingID, &e.Source, &e.Data, &e.EnrichedAt); err != nil {
			return nil, fmt.Errorf("enrichment.GetFindingEnrichments: scan: %w", err)
		}
		enrichments = append(enrichments, e)
	}
	return enrichments, rows.Err()
}

// GetFindingScore возвращает score для finding.
func GetFindingScore(ctx context.Context, pool *pgxpool.Pool, findingID uuid.UUID) (*domain.FindingScore, error) {
	var s domain.FindingScore
	err := pool.QueryRow(ctx, `
		SELECT finding_id, base_score, epss_score, epss_percentile,
		       is_kev, is_bdu, priority_score, calculated_at
		FROM finding_scores WHERE finding_id = $1
	`, findingID).Scan(&s.FindingID, &s.BaseScore, &s.EPSSScore, &s.EPSSPercentile,
		&s.IsKEV, &s.IsBDU, &s.PriorityScore, &s.CalculatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("enrichment.GetFindingScore: %w", err)
	}
	return &s, nil
}
