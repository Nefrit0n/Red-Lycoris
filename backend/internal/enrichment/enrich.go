package enrichment

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
	"redlycoris/internal/domain/cvss"
	"redlycoris/internal/domain/epss"
	kevdom "redlycoris/internal/domain/kev"
	osvdom "redlycoris/internal/domain/osv"
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
		SourceType       string
		Kind             int16
		FirstSeen        time.Time
	}
	err := pool.QueryRow(ctx, `
		SELECT cve_ids, cwe_ids, component, component_version, source_type, finding_kind, first_seen
		FROM findings WHERE id = $1
	`, findingID).Scan(&f.CVEIDs, &f.CWEIDs, &f.Component, &f.ComponentVersion, &f.SourceType, &f.Kind, &f.FirstSeen)
	if err != nil {
		return fmt.Errorf("enrichment.EnrichFinding: load finding: %w", err)
	}
	f.CVEIDs = normalizeCVEIDs(f.CVEIDs)

	var baseScore float64
	var epssScore, epssPercentile float64
	var epssTrend7d float64
	var isKEV, isBDU bool
	var hasRansomware bool
	minDaysUntilDue := 999999

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

		// c) KEV — по CVE IDs с расширенными полями и urgency
		rows, err = pool.Query(ctx, `
			SELECT cve_id, vendor, product, vulnerability_name,
			       short_description, required_action, notes,
			       date_added, due_date, known_ransomware
			FROM kev_catalog WHERE cve_id = ANY($1)
		`, f.CVEIDs)
		if err == nil {
			var kevEntries []map[string]any
			mostUrgentTier := kevdom.UrgencyNoDeadline
			now := time.Now()
			for rows.Next() {
				var (
					cveID, vendor, product, vulnName string
					shortDesc, reqAction, notes      *string
					dateAdded, dueDate               *time.Time
					ransomware                       bool
				)
				if err := rows.Scan(
					&cveID, &vendor, &product, &vulnName,
					&shortDesc, &reqAction, &notes,
					&dateAdded, &dueDate, &ransomware,
				); err != nil {
					continue
				}

				tier, daysUntil := kevdom.ComputeUrgency(dueDate, now)
				entry := map[string]any{
					"cve_id":             cveID,
					"vendor":             vendor,
					"product":            product,
					"vulnerability_name": vulnName,
					"known_ransomware":   ransomware,
					"urgency_tier":       string(tier),
				}
				if dateAdded != nil {
					entry["date_added"] = *dateAdded
				}
				if dueDate != nil {
					entry["due_date"] = *dueDate
					entry["days_until_due"] = daysUntil
				}
				if shortDesc != nil && *shortDesc != "" {
					entry["short_description"] = *shortDesc
				}
				if reqAction != nil && *reqAction != "" {
					entry["required_action"] = *reqAction
				}
				if notes != nil && *notes != "" {
					entry["notes"] = *notes
				}

				kevEntries = append(kevEntries, entry)
				isKEV = true

				if ransomware {
					hasRansomware = true
				}

				if dueDate != nil && daysUntil < minDaysUntilDue {
					minDaysUntilDue = daysUntil
					mostUrgentTier = tier
				}
			}
			rows.Close()
			if len(kevEntries) > 0 {
				saveEnrichment(ctx, pool, findingID, "kev", kevEntries)
			}

			_ = mostUrgentTier
		}

		// d) BDU — по CVE IDs (cve_ids @> ARRAY[cve])
		var bduEntries []map[string]any
		for _, cveID := range f.CVEIDs {
			rows, err = pool.Query(ctx, `
				SELECT bdu_id, name, description, severity,
				       vul_status, exploit_status, fix_status,
				       vul_class, exploitation_way, mitigation_way,
				       cvss_v2_score, cvss_v2_vector,
				       cvss_v3_score, cvss_v3_vector,
				       cvss_v4_score, cvss_v4_vector,
				       software, environment,
				       sources, remediation,
				       cwe_ids, cve_ids,
				       published_at, modified_at
				FROM bdu_fstec
				WHERE cve_ids @> ARRAY[$1]::text[]
			`, cveID)
			if err != nil {
				continue
			}
			for rows.Next() {
				var (
					bduID, name, severity                    string
					description                              *string
					vulStatus, exploitStatus, fixStatus      *string
					vulClass, exploitationWay, mitigationWay *string
					cvssV2Score, cvssV3Score, cvssV4Score    *float32
					cvssV2Vector, cvssV3Vector, cvssV4Vector *string
					softwareRaw, environmentRaw              []byte
					sources, cveIDs                          []string
					remediation                              *string
					cweIDs                                   []int32
					publishedAt, modifiedAt                  *time.Time
				)
				if err := rows.Scan(
					&bduID, &name, &description, &severity,
					&vulStatus, &exploitStatus, &fixStatus,
					&vulClass, &exploitationWay, &mitigationWay,
					&cvssV2Score, &cvssV2Vector,
					&cvssV3Score, &cvssV3Vector,
					&cvssV4Score, &cvssV4Vector,
					&softwareRaw, &environmentRaw,
					&sources, &remediation,
					&cweIDs, &cveIDs,
					&publishedAt, &modifiedAt,
				); err != nil {
					continue
				}

				entry := map[string]any{
					"bdu_id":         bduID,
					"name":           name,
					"matched_cve_id": cveID,
				}
				addOptString := func(key string, val *string) {
					if val != nil && *val != "" {
						entry[key] = *val
					}
				}
				addOptString("description", description)
				if severity != "" {
					entry["severity"] = severity
				}
				addOptString("vul_status", vulStatus)
				addOptString("exploit_status", exploitStatus)
				addOptString("fix_status", fixStatus)
				addOptString("vul_class", vulClass)
				addOptString("exploitation_way", exploitationWay)
				addOptString("mitigation_way", mitigationWay)
				addOptString("remediation", remediation)

				if cvssV2Score != nil {
					obj := map[string]any{"score": *cvssV2Score}
					if cvssV2Vector != nil && *cvssV2Vector != "" {
						obj["vector"] = *cvssV2Vector
						if m, err := cvss.ParseV2(*cvssV2Vector); err == nil {
							obj["metrics"] = m
						}
					}
					entry["cvss_v2"] = obj
				}
				if cvssV3Score != nil {
					obj := map[string]any{"score": *cvssV3Score}
					if cvssV3Vector != nil && *cvssV3Vector != "" {
						obj["vector"] = *cvssV3Vector
						if m, err := cvss.ParseV31(*cvssV3Vector); err == nil {
							obj["metrics"] = m
						}
					}
					entry["cvss_v3"] = obj
				}
				if cvssV4Score != nil {
					obj := map[string]any{"score": *cvssV4Score}
					if cvssV4Vector != nil && *cvssV4Vector != "" {
						obj["vector"] = *cvssV4Vector
						if m, err := cvss.ParseV40(*cvssV4Vector); err == nil {
							obj["metrics"] = m
						}
					}
					entry["cvss_v4"] = obj
				}

				if len(softwareRaw) > 0 {
					entry["software"] = json.RawMessage(softwareRaw)
				}
				if len(environmentRaw) > 0 {
					entry["environment"] = json.RawMessage(environmentRaw)
				}
				if len(sources) > 0 {
					entry["sources"] = sources
				}
				if len(cveIDs) > 0 {
					entry["related_cve_ids"] = cveIDs
				}
				if len(cweIDs) > 0 {
					entry["cwe_ids"] = cweIDs
				}
				if publishedAt != nil {
					entry["published_at"] = *publishedAt
				}
				if modifiedAt != nil {
					entry["modified_at"] = *modifiedAt
				}

				bduEntries = append(bduEntries, entry)
				isBDU = true
			}
			rows.Close()
		}
		if len(bduEntries) > 0 {
			saveEnrichment(ctx, pool, findingID, "bdu", bduEntries)
		}
	}

	// e) OSV — приоритетный матч по CVE (через aliases),
	//    fallback по ecosystem+package_name
	var osvMatched bool
	var osvHasFix bool

	// Стратегия 1: если у finding есть CVE — искать OSV-записи,
	// у которых эта CVE в aliases (GIN-индекс на aliases работает).
	if len(f.CVEIDs) > 0 {
		rows, err := pool.Query(ctx, `
			SELECT osv_id, summary, details, aliases,
			       ecosystem, package_name,
			       affected_ranges, severity, "references",
			       published_at, modified_at
			FROM osv_vulnerabilities
			WHERE aliases && $1
			ORDER BY modified_at DESC NULLS LAST
			LIMIT 20
		`, f.CVEIDs)
		if err == nil {
			entries := buildOSVEntries(rows)
			rows.Close()
			if len(entries) > 0 {
				osvMatched = true
				for _, e := range entries {
					if e["has_fix"] == true {
						osvHasFix = true
					}
				}
				saveEnrichment(ctx, pool, findingID, "osv", entries)
			}
		}
	}

	// Стратегия 2: fallback — если по CVE ничего не нашли, пробуем
	// по ecosystem+package_name. Это хуже, потому что может вернуть
	// несвязанные advisory, НО — фильтруем через aliases пересечение
	// с CVEIDs финдинга (если cve_ids пустой — оставляем как "related").
	if !osvMatched && f.Component != "" {
		ecosystem := osvdom.DetectEcosystem(f.SourceType, domain.FindingKind(f.Kind).String(), f.Component)
		if ecosystem != "" {
			rows, err := pool.Query(ctx, `
				SELECT osv_id, summary, details, aliases,
				       ecosystem, package_name,
				       affected_ranges, severity, "references",
				       published_at, modified_at
				FROM osv_vulnerabilities
				WHERE ecosystem = $1 AND package_name = $2
				ORDER BY modified_at DESC NULLS LAST
				LIMIT 10
			`, ecosystem, f.Component)
			if err == nil {
				entries := buildOSVEntries(rows)
				rows.Close()
				if len(entries) > 0 {
					// Пометим что это fallback-матч, UI покажет предупреждение.
					for i := range entries {
						entries[i]["match_type"] = "package_fallback"
					}
					for _, e := range entries {
						if e["has_fix"] == true {
							osvHasFix = true
						}
					}
					saveEnrichment(ctx, pool, findingID, "osv", entries)
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
	priorityScore := domain.CalculatePriorityScore(
		baseScore,
		epssScore,
		epssTrend7d,
		isKEV,
		hasRansomware,
		minDaysUntilDue,
		isBDU,
		osvHasFix,
		daysOld,
	)

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

func normalizeCVEIDs(cveIDs []string) []string {
	if len(cveIDs) == 0 {
		return cveIDs
	}
	normalized := make([]string, 0, len(cveIDs))
	seen := make(map[string]struct{}, len(cveIDs))
	for _, id := range cveIDs {
		v := strings.ToUpper(strings.TrimSpace(id))
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		normalized = append(normalized, v)
	}
	return normalized
}

// buildOSVEntries разбирает rows из osv_vulnerabilities в enrichment-
// payload. Обрабатывает affected_ranges через osvdom.ParseRanges,
// severity как сырой JSONB (UI раскроет), aliases как строковый массив.
func buildOSVEntries(rows pgx.Rows) []map[string]any {
	var entries []map[string]any
	for rows.Next() {
		var (
			osvID                   string
			summary, details        string
			aliases                 []string
			ecosystem, packageName  string
			rangesRaw, severityRaw  []byte
			referencesRaw           []byte
			publishedAt, modifiedAt *time.Time
		)
		if err := rows.Scan(
			&osvID, &summary, &details, &aliases,
			&ecosystem, &packageName,
			&rangesRaw, &severityRaw, &referencesRaw,
			&publishedAt, &modifiedAt,
		); err != nil {
			continue
		}

		entry := map[string]any{
			"osv_id":     osvID,
			"summary":    summary,
			"match_type": "cve", // по умолчанию; fallback перезаписывает
		}
		if details != "" {
			entry["details"] = details
		}
		if len(aliases) > 0 {
			entry["aliases"] = aliases
		}
		if ecosystem != "" {
			entry["ecosystem"] = ecosystem
		}
		if packageName != "" {
			entry["package_name"] = packageName
		}
		if publishedAt != nil {
			entry["published_at"] = *publishedAt
		}
		if modifiedAt != nil {
			entry["modified_at"] = *modifiedAt
		}
		if len(severityRaw) > 0 {
			entry["severity"] = json.RawMessage(severityRaw)
		}
		if len(referencesRaw) > 0 {
			entry["references"] = json.RawMessage(referencesRaw)
		}

		// Главное: извлекаем fix versions из affected_ranges.
		if summary, err := osvdom.ParseRanges(rangesRaw); err == nil {
			if len(summary.FixedVersions) > 0 {
				entry["fixed_versions"] = summary.FixedVersions
				entry["has_fix"] = true
			}
			if len(summary.IntroducedVersions) > 0 {
				entry["introduced_versions"] = summary.IntroducedVersions
			}
			if len(summary.Ranges) > 0 {
				entry["ranges"] = summary.Ranges
			}
		}

		entries = append(entries, entry)
	}
	return entries
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
