package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"redlycoris/internal/domain"
	htmlexport "redlycoris/internal/export"
	"redlycoris/internal/storage"
)

func (h *exportHandlers) handleHTML() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, ok, empty := parseFindingsFilter(w, r, h.rolesRepo)
		if !ok {
			return
		}
		if !h.takeExportSlot(w, r) {
			return
		}
		defer h.releaseExportSlot(r)

		if empty {
			filter.Limit = 1
		}

		check := filter
		check.Limit = 1
		check.Cursor = ""
		_, _, total, err := h.findingsRepo.List(r.Context(), check)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings")
			return
		}
		if total > htmlexport.MaxHTMLRows {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "html export exceeds 5000 rows; use XLSX or refine filters")
			return
		}

		includeDetails, includeRaw, err := parseIncludeDetails(r, total)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		findings, err := h.collectFindings(r, filter)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings")
			return
		}
		sort.Slice(findings, func(i, j int) bool {
			if findings[i].Severity == findings[j].Severity {
				return findings[i].LastSeen.After(findings[j].LastSeen)
			}
			return findings[i].Severity > findings[j].Severity
		})

		headerTitle := buildReportTitle(r, filter)
		filtersJSON := "{}"
		if b, jerr := json.Marshal(readFiltersMap(r)); jerr == nil {
			filtersJSON = string(b)
		}
		version := h.version
		if bi, ok := debug.ReadBuildInfo(); ok {
			version = version + " " + shortBuildCommit(bi)
		}
		author := ""
		if user, ok := UserFromContext(r.Context()); ok {
			author = user.Email
		}

		detailsFindings := findings
		detailsHidden := 0
		autoHidden := includeRaw == "auto" && !includeDetails
		if includeDetails && len(detailsFindings) > htmlexport.MaxHTMLDetailRows {
			detailsHidden = len(detailsFindings) - htmlexport.MaxHTMLDetailRows
			detailsFindings = detailsFindings[:htmlexport.MaxHTMLDetailRows]
		}
		if !includeDetails {
			detailsFindings = nil
		}

		bduByCVE := h.fetchBDUByCVEs(r, findings)

		reportData := htmlexport.ReportData{
			HeaderTitle:    headerTitle,
			Summary:        htmlexport.BuildSummary(findings),
			StatusRows:     htmlexport.BuildStatusRows(findings),
			TableFindings:  findings,
			DetailFindings: detailsFindings,
			TopCVEs:        htmlexport.BuildTopCVEs(findings, 20, bduByCVE),
			Components:     htmlexport.BuildComponents(findings, 100),
		}
		var htmlBody bytes.Buffer
		err = htmlexport.ExecuteHTMLReport(&htmlBody, reportData, htmlexport.ReportOptions{
			Title:             r.URL.Query().Get("title"),
			GeneratedAt:       time.Now(),
			AuthorEmail:       author,
			Platform:          "Red Lycoris " + strings.TrimSpace(version),
			FiltersJSON:       filtersJSON,
			IncludeDetails:    includeDetails,
			DetailsHidden:     detailsHidden,
			DetailsAutoHidden: autoHidden,
			FilterChips:       buildFilterChips(r),
			BDUByCVE:          bduByCVE,
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to render html export")
			return
		}
		fileName := fmt.Sprintf("redlycoris-report-%s.html", time.Now().Format("2006-01-02_150405"))
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
		w.Header().Set("X-Export-Total", strconv.Itoa(total))
		w.WriteHeader(http.StatusOK)
		_, _ = io.Copy(w, &htmlBody)
		h.writeExportAudit(r, "html:"+includeRaw, filter, total)
	}
}

func parseIncludeDetails(r *http.Request, total int) (bool, string, error) {
	raw := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("include_details")))
	if raw == "" || raw == "auto" {
		return total <= htmlexport.MaxHTMLDetailRows, "auto", nil
	}
	if raw == "true" {
		if total > htmlexport.MaxHTMLDetailRows {
			return false, raw, fmt.Errorf("details export exceeds 500 rows")
		}
		return true, raw, nil
	}
	if raw == "false" {
		return false, raw, nil
	}
	return false, raw, fmt.Errorf("invalid include_details")
}

func (h *exportHandlers) collectFindings(r *http.Request, filter storage.FindingsFilter) ([]domain.Finding, error) {
	filter.Limit = exportBatchSize
	filter.Cursor = ""
	out := make([]domain.Finding, 0)
	for {
		batch, next, _, err := h.findingsRepo.List(r.Context(), filter)
		if err != nil {
			return nil, err
		}
		if len(batch) == 0 {
			break
		}
		out = append(out, batch...)
		if next == "" {
			break
		}
		filter.Cursor = next
	}
	return out, nil
}

func (h *exportHandlers) fetchBDUByCVEs(r *http.Request, findings []domain.Finding) map[string]string {
	out := map[string]string{}
	set := map[string]struct{}{}
	for _, f := range findings {
		for _, cve := range f.CVEIDs {
			if strings.TrimSpace(cve) != "" {
				set[cve] = struct{}{}
			}
		}
	}
	if len(set) == 0 {
		return out
	}
	cves := make([]string, 0, len(set))
	for c := range set {
		cves = append(cves, c)
	}
	rows, err := h.findingsRepo.DB().Query(r.Context(), `SELECT bdu_id, cve_ids FROM bdu_fstec WHERE cve_ids && $1`, cves)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var bduID string
		var rowCVEs []string
		if err := rows.Scan(&bduID, &rowCVEs); err != nil {
			continue
		}
		for _, c := range rowCVEs {
			if _, ok := set[c]; ok {
				if _, exists := out[c]; !exists {
					out[c] = bduID
				}
			}
		}
	}
	if rows.Err() != nil {
		return out
	}
	return out
}

func shortBuildCommit(bi *debug.BuildInfo) string {
	for _, s := range bi.Settings {
		if s.Key == "vcs.revision" && s.Value != "" {
			if len(s.Value) > 8 {
				return s.Value[:8]
			}
			return s.Value
		}
	}
	return ""
}

func buildReportTitle(r *http.Request, filter storage.FindingsFilter) string {
	if t := strings.TrimSpace(r.URL.Query().Get("title")); t != "" {
		return t
	}
	sev := strings.TrimSpace(r.URL.Query().Get("severity"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if filter.ProjectID != uuid.Nil {
		if sev != "" {
			return "Отчёт по проекту: severity " + sev
		}
		return "Отчёт по проекту"
	}
	if sev != "" || status != "" {
		return "Отчёт по всем проектам: фильтры severity/status"
	}
	return "Отчёт по всем проектам"
}

func buildFilterChips(r *http.Request) []string {
	q := r.URL.Query()
	keys := []string{"project_id", "severity", "status", "kinds", "has_fix", "has_cve", "in_kev", "in_bdu", "q", "component", "cve"}
	out := make([]string, 0, len(keys))
	for _, k := range keys {
		v := strings.TrimSpace(q.Get(k))
		if v != "" {
			out = append(out, fmt.Sprintf("%s: %s", k, v))
		}
	}
	return out
}
