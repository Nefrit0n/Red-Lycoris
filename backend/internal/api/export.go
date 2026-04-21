package api

import (
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/xuri/excelize/v2"

	"redlycoris/internal/audit"
	"redlycoris/internal/domain"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/storage"
)

const (
	exportBatchSize = 1000
	exportMaxRows   = 100000
)

type exportHandlers struct {
	findingsRepo *storage.FindingsRepo
	rolesRepo    *storage.UserProjectRolesRepo
	projectsRepo *storage.ProjectsRepo
	auditWriter  *audit.Writer
	rdb          *redis.Client
	version      string
}

type cveAgg struct {
	Count    int
	Projects map[string]struct{}
	MaxSev   int
	EPSS     float64
	InKEV    bool
	InBDU    bool
}

type compAgg struct {
	Count    int
	MaxSev   int
	HasFixed bool
	Projects map[string]struct{}
}

func newExportHandlers(findingsRepo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo, projectsRepo *storage.ProjectsRepo, auditWriter *audit.Writer, rdb *redis.Client, version string) *exportHandlers {
	return &exportHandlers{findingsRepo: findingsRepo, rolesRepo: rolesRepo, projectsRepo: projectsRepo, auditWriter: auditWriter, rdb: rdb, version: version}
}

func (h *exportHandlers) handleCSV() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, total, fileName, _, ok := h.prepareExport(w, r, "csv")
		if !ok {
			return
		}

		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
		w.Header().Set("X-Export-Total", strconv.Itoa(total))
		w.WriteHeader(http.StatusOK)

		_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
		cw := csv.NewWriter(w)
		header := []string{"id", "project_name", "severity", "status", "confidence", "title", "cve_ids", "cwe_ids", "component", "component_version", "fixed_version", "file_path", "line_start", "line_end", "url", "http_method", "priority_score", "epss_score", "is_kev", "is_bdu", "first_seen", "last_seen", "times_seen", "source_type", "rule_id", "assignee_email"}
		if err := cw.Write(header); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to stream csv")
			return
		}

		flusher, _ := w.(http.Flusher)
		filter.Limit = exportBatchSize
		cursor := ""
		rows := 0
		for {
			filter.Cursor = cursor
			batch, nextCursor, _, err := h.findingsRepo.List(r.Context(), filter)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings")
				return
			}
			if len(batch) == 0 {
				break
			}
			for _, f := range batch {
				if err := cw.Write([]string{
					f.ID.String(),
					f.ProjectName,
					severityLabel(f.Severity),
					statusLabel(f.Status),
					strconv.Itoa(f.Confidence),
					f.Title,
					strings.Join(f.CVEIDs, ";"),
					joinInt(f.CWEIDs, ";"),
					f.Component,
					f.ComponentVersion,
					ptrString(f.FixedVersion),
					f.FilePath,
					strconv.Itoa(f.LineStart),
					strconv.Itoa(f.LineEnd),
					ptrString(f.URL),
					ptrString(f.HttpMethod),
					formatFloatPtr(f.PriorityScore),
					formatFloatPtr(f.MaxEPSS),
					boolRU(f.InKEV),
					boolRU(f.InBDU),
					f.FirstSeen.UTC().Format(time.RFC3339),
					f.LastSeen.UTC().Format(time.RFC3339),
					strconv.Itoa(f.TimesSeen),
					f.SourceType,
					ptrString(f.RuleID),
					f.AssigneeEmail,
				}); err != nil {
					respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to stream csv")
					return
				}
				rows++
				if rows%100 == 0 {
					cw.Flush()
					if flusher != nil {
						flusher.Flush()
					}
				}
			}
			cw.Flush()
			if err := cw.Error(); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to stream csv")
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
			if nextCursor == "" {
				break
			}
			cursor = nextCursor
		}
		h.writeExportAudit(r, "csv", filter, total)
	}
}

func (h *exportHandlers) handleNDJSON() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, total, fileName, filtersMap, ok := h.prepareExport(w, r, "json")
		if !ok {
			return
		}
		w.Header().Set("Content-Type", "application/x-ndjson")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
		w.Header().Set("X-Export-Total", strconv.Itoa(total))
		enc := json.NewEncoder(w)

		meta := map[string]any{"_meta": map[string]any{"exported_at": time.Now().UTC().Format(time.RFC3339), "filters": filtersMap, "total_estimated": total, "platform_version": h.version}}
		if err := enc.Encode(meta); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to stream ndjson")
			return
		}
		flusher, _ := w.(http.Flusher)
		if flusher != nil {
			flusher.Flush()
		}

		filter.Limit = exportBatchSize
		cursor := ""
		rows := 0
		for {
			filter.Cursor = cursor
			batch, nextCursor, _, err := h.findingsRepo.List(r.Context(), filter)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings")
				return
			}
			if len(batch) == 0 {
				break
			}
			for _, f := range batch {
				payload := map[string]any{"finding": f}
				if enrichments, err := enrichment.GetFindingEnrichments(r.Context(), h.findingsRepo.DB(), f.ID); err == nil && len(enrichments) > 0 {
					payload["enrichments"] = enrichments
				}
				if score, err := enrichment.GetFindingScore(r.Context(), h.findingsRepo.DB(), f.ID); err == nil && score != nil {
					payload["score"] = score
				}
				if err := enc.Encode(payload); err != nil {
					respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to stream ndjson")
					return
				}
				rows++
				if rows%100 == 0 && flusher != nil {
					flusher.Flush()
				}
			}
			if nextCursor == "" {
				break
			}
			cursor = nextCursor
		}
		h.writeExportAudit(r, "json", filter, total)
	}
}

func (h *exportHandlers) handleXLSX() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, total, fileName, filtersMap, ok := h.prepareExport(w, r, "xlsx")
		if !ok {
			return
		}
		f := excelize.NewFile()
		defer func() { _ = f.Close() }()
		f.SetSheetName("Sheet1", "Summary")
		_ = f.NewSheet("Findings")
		_ = f.NewSheet("By CVE")
		_ = f.NewSheet("By Component")
		_ = f.NewSheet("About")

		headers := []string{"id", "project_name", "severity", "status", "confidence", "title", "cve_ids", "cwe_ids", "component", "component_version", "fixed_version", "file_path", "line_start", "line_end", "url", "http_method", "priority_score", "epss_score", "is_kev", "is_bdu", "first_seen", "last_seen", "times_seen", "source_type", "rule_id", "assignee_email", "description", "extra_urls"}
		stream, err := f.NewStreamWriter("Findings")
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to prepare xlsx stream")
			return
		}
		headerIface := make([]any, 0, len(headers))
		for _, h := range headers {
			headerIface = append(headerIface, h)
		}
		if err := stream.SetRow("A1", headerIface); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to write xlsx header")
			return
		}

		sevCounts := map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
		statusCounts := map[string]int{"open": 0, "confirmed": 0, "false_positive": 0, "fixed": 0, "accepted_risk": 0}
		cveMap := map[string]*cveAgg{}
		compMap := map[string]*compAgg{}

		rowNum := 2
		filter.Limit = exportBatchSize
		cursor := ""
		for {
			filter.Cursor = cursor
			batch, nextCursor, _, err := h.findingsRepo.List(r.Context(), filter)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings")
				return
			}
			if len(batch) == 0 {
				break
			}
			for _, item := range batch {
				sev := severityLabel(item.Severity)
				status := statusLabel(item.Status)
				sevCounts[sev]++
				statusCounts[status]++
				key := item.Component + "@" + item.ComponentVersion
				if _, ok := compMap[key]; !ok {
					compMap[key] = &compAgg{Projects: map[string]struct{}{}, MaxSev: -1}
				}
				ca := compMap[key]
				ca.Count++
				if item.Severity > ca.MaxSev {
					ca.MaxSev = item.Severity
				}
				ca.HasFixed = ca.HasFixed || item.FixedVersion != nil
				ca.Projects[item.ProjectName] = struct{}{}

				for _, cve := range item.CVEIDs {
					if _, ok := cveMap[cve]; !ok {
						cveMap[cve] = &cveAgg{Projects: map[string]struct{}{}, MaxSev: -1}
					}
					cv := cveMap[cve]
					cv.Count++
					if item.Severity > cv.MaxSev {
						cv.MaxSev = item.Severity
					}
					if item.MaxEPSS != nil && *item.MaxEPSS > cv.EPSS {
						cv.EPSS = *item.MaxEPSS
					}
					cv.InKEV = cv.InKEV || item.InKEV
					cv.InBDU = cv.InBDU || item.InBDU
					cv.Projects[item.ProjectName] = struct{}{}
				}

				desc := item.Description
				if len(desc) > 500 {
					desc = desc[:500]
				}
				row := []any{item.ID.String(), item.ProjectName, sev, status, item.Confidence, item.Title, strings.Join(item.CVEIDs, ";"), joinInt(item.CWEIDs, ";"), item.Component, item.ComponentVersion, ptrString(item.FixedVersion), item.FilePath, item.LineStart, item.LineEnd, ptrString(item.URL), ptrString(item.HttpMethod), formatFloatPtr(item.PriorityScore), formatFloatPtr(item.MaxEPSS), boolRU(item.InKEV), boolRU(item.InBDU), item.FirstSeen.UTC().Format(time.RFC3339), item.LastSeen.UTC().Format(time.RFC3339), item.TimesSeen, item.SourceType, ptrString(item.RuleID), item.AssigneeEmail, desc, ""}
				cell, _ := excelize.CoordinatesToCellName(1, rowNum)
				if err := stream.SetRow(cell, row); err != nil {
					respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to stream xlsx")
					return
				}
				rowNum++
			}
			if nextCursor == "" {
				break
			}
			cursor = nextCursor
		}
		if err := stream.Flush(); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to finalize xlsx")
			return
		}

		writeSummarySheet(f, filtersMap, total, sevCounts, statusCounts, compMap)
		writeByCVESheet(f, cveMap)
		writeByComponentSheet(f, compMap)
		writeAboutSheet(f, h.version, total, filtersMap)
		_ = f.SetPanes("Findings", &excelize.Pane{})
		_ = f.AutoFilter("Findings", "A1", "AB1", nil)
		_ = setBasicSheetStyle(f, "Findings", headers)

		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
		w.Header().Set("X-Export-Total", strconv.Itoa(total))
		if err := f.Write(w); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to write xlsx")
			return
		}
		h.writeExportAudit(r, "xlsx", filter, total)
	}
}

func (h *exportHandlers) prepareExport(w http.ResponseWriter, r *http.Request, format string) (storage.FindingsFilter, int, string, map[string]any, bool) {
	filter, ok, empty := parseFindingsFilter(w, r, h.rolesRepo)
	if !ok {
		return filter, 0, "", nil, false
	}
	if !h.takeExportSlot(w, r) {
		return filter, 0, "", nil, false
	}
	if empty {
		name := h.buildFilename(r.Context(), format, filter.ProjectID)
		return filter, 0, name, readFiltersMap(r), true
	}
	checkFilter := filter
	checkFilter.Limit = 1
	checkFilter.Cursor = ""
	_, _, total, err := h.findingsRepo.List(r.Context(), checkFilter)
	if err != nil {
		respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings")
		return filter, 0, "", nil, false
	}
	if total > exportMaxRows {
		respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "export exceeds 100000 rows, refine filters")
		return filter, 0, "", nil, false
	}
	name := h.buildFilename(r.Context(), format, filter.ProjectID)
	return filter, total, name, readFiltersMap(r), true
}

func (h *exportHandlers) buildFilename(ctx context.Context, format string, projectID uuid.UUID) string {
	ts := time.Now().UTC().Format("2006-01-02_150405")
	base := "redlycoris-findings"
	if projectID != uuid.Nil {
		if p, err := h.projectsRepo.GetByID(ctx, projectID); err == nil {
			base += "-" + sanitizeSlug(p.Name)
		}
	}
	return fmt.Sprintf("%s-%s.%s", base, ts, format)
}

func (h *exportHandlers) takeExportSlot(w http.ResponseWriter, r *http.Request) bool {
	if h.rdb == nil {
		return true
	}
	uid := "anonymous"
	if user, ok := UserFromContext(r.Context()); ok {
		uid = user.ID.String()
	} else if tok, ok := APITokenFromContext(r.Context()); ok {
		uid = tok.TokenID
	}
	concurrencyKey := "ratelimit:export:concurrent:" + uid
	windowKey := "ratelimit:export:window:" + uid
	concurrency, err := h.rdb.Incr(r.Context(), concurrencyKey).Result()
	if err != nil {
		return true
	}
	if concurrency == 1 {
		_ = h.rdb.Expire(r.Context(), concurrencyKey, 2*time.Minute).Err()
	}
	if concurrency > 3 {
		_ = h.rdb.Decr(r.Context(), concurrencyKey).Err()
		respondError(w, r, http.StatusTooManyRequests, "RATE_LIMITED", "too many concurrent exports")
		return false
	}
	window, err := h.rdb.Incr(r.Context(), windowKey).Result()
	if err == nil && window == 1 {
		_ = h.rdb.Expire(r.Context(), windowKey, 5*time.Minute).Err()
	}
	if err == nil && window > 10 {
		_ = h.rdb.Decr(r.Context(), concurrencyKey).Err()
		respondError(w, r, http.StatusTooManyRequests, "RATE_LIMITED", "too many export requests")
		return false
	}
	return true
}

func (h *exportHandlers) writeExportAudit(r *http.Request, format string, filter storage.FindingsFilter, rows int) {
	if h.auditWriter == nil {
		return
	}
	action := "findings.export"
	resourceType := "finding"
	h.auditWriter.Submit(storage.AuditRecord{
		ID:           uuid.New(),
		Method:       r.Method,
		Path:         r.URL.Path,
		FullPath:     r.URL.RequestURI(),
		StatusCode:   http.StatusOK,
		DurationMs:   0,
		CreatedAt:    time.Now().UTC(),
		Action:       &action,
		ResourceType: &resourceType,
		Changes:      []storage.AuditChange{{Field: "format", After: format}, {Field: "rows", After: rows}, {Field: "filters", After: filter}},
	})
	if h.rdb != nil {
		uid := "anonymous"
		if user, ok := UserFromContext(r.Context()); ok {
			uid = user.ID.String()
		} else if tok, ok := APITokenFromContext(r.Context()); ok {
			uid = tok.TokenID
		}
		_ = h.rdb.Decr(r.Context(), "ratelimit:export:concurrent:"+uid).Err()
	}
}

func severityLabel(s int) string {
	switch s {
	case domain.SeverityCritical:
		return "critical"
	case domain.SeverityHigh:
		return "high"
	case domain.SeverityMedium:
		return "medium"
	case domain.SeverityLow:
		return "low"
	default:
		return "info"
	}
}

func statusLabel(s int) string {
	switch s {
	case domain.StatusOpen:
		return "open"
	case domain.StatusConfirmed:
		return "confirmed"
	case domain.StatusFP:
		return "false_positive"
	case domain.StatusResolved:
		return "fixed"
	default:
		return "accepted_risk"
	}
}

func ptrString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
func boolRU(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}
func formatFloatPtr(v *float64) string {
	if v == nil {
		return ""
	}
	return strconv.FormatFloat(*v, 'f', -1, 64)
}
func joinInt(items []int, sep string) string {
	parts := make([]string, 0, len(items))
	for _, item := range items {
		parts = append(parts, strconv.Itoa(item))
	}
	return strings.Join(parts, sep)
}

func readFiltersMap(r *http.Request) map[string]any {
	out := map[string]any{}
	for k, v := range r.URL.Query() {
		if len(v) == 1 {
			out[k] = v[0]
		} else {
			out[k] = v
		}
	}
	return out
}

func sanitizeSlug(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	v = strings.ReplaceAll(v, " ", "-")
	var b strings.Builder
	for _, ch := range v {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-' {
			b.WriteRune(ch)
		}
	}
	if b.Len() == 0 {
		return "project"
	}
	return b.String()
}

func setBasicSheetStyle(f *excelize.File, sheet string, headers []string) error {
	style, _ := f.NewStyle(excelize.Style{Font: &excelize.Font{Bold: true}, Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#E5E7EB"}}})
	end, _ := excelize.CoordinatesToCellName(len(headers), 1)
	_ = f.SetCellStyle(sheet, "A1", end, style)
	for i := range headers {
		col, _ := excelize.ColumnNumberToName(i + 1)
		_ = f.SetColWidth(sheet, col, col, 18)
	}
	return nil
}

func writeSummarySheet(f *excelize.File, filters map[string]any, total int, sevCounts, statusCounts map[string]int, comp map[string]*compAgg) {
	_ = f.SetCellValue("Summary", "A1", "Контекст выгрузки")
	_ = f.SetCellValue("Summary", "A2", "Дата")
	_ = f.SetCellValue("Summary", "B2", time.Now().UTC().Format(time.RFC3339))
	_ = f.SetCellValue("Summary", "A3", "Фильтры")
	buf, _ := json.Marshal(filters)
	_ = f.SetCellValue("Summary", "B3", string(buf))
	_ = f.SetCellValue("Summary", "A4", "Всего")
	_ = f.SetCellValue("Summary", "B4", total)

	row := 6
	_ = f.SetCellValue("Summary", "A6", "Распределение по severity")
	for _, s := range []string{"critical", "high", "medium", "low", "info"} {
		row++
		_ = f.SetCellValue("Summary", fmt.Sprintf("A%d", row), s)
		_ = f.SetCellValue("Summary", fmt.Sprintf("B%d", row), sevCounts[s])
	}
	row += 2
	_ = f.SetCellValue("Summary", fmt.Sprintf("A%d", row), "Распределение по статусам")
	for _, s := range []string{"open", "confirmed", "false_positive", "fixed", "accepted_risk"} {
		row++
		_ = f.SetCellValue("Summary", fmt.Sprintf("A%d", row), s)
		_ = f.SetCellValue("Summary", fmt.Sprintf("B%d", row), statusCounts[s])
	}

	type pair struct {
		K   string
		C   int
		Sev int
	}
	items := make([]pair, 0, len(comp))
	for k, v := range comp {
		items = append(items, pair{K: k, C: v.Count, Sev: v.MaxSev})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].C > items[j].C })
	row += 2
	_ = f.SetCellValue("Summary", fmt.Sprintf("A%d", row), "Топ-10 компонентов")
	for i := 0; i < len(items) && i < 10; i++ {
		row++
		_ = f.SetCellValue("Summary", fmt.Sprintf("A%d", row), items[i].K)
		_ = f.SetCellValue("Summary", fmt.Sprintf("B%d", row), items[i].C)
		_ = f.SetCellValue("Summary", fmt.Sprintf("C%d", row), severityLabel(items[i].Sev))
	}
}

func writeByCVESheet(f *excelize.File, cveMap map[string]*cveAgg) {
	headers := []string{"cve", "findings_count", "projects", "max_severity", "epss_score", "in_kev", "in_bdu"}
	for i, h := range headers {
		c, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue("By CVE", c, h)
	}
	type row struct {
		CVE string
		*cveAgg
	}
	rows := make([]row, 0, len(cveMap))
	for k, v := range cveMap {
		rows = append(rows, row{CVE: k, cveAgg: v})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Count > rows[j].Count })
	for idx, item := range rows {
		r := idx + 2
		_ = f.SetCellValue("By CVE", fmt.Sprintf("A%d", r), item.CVE)
		_ = f.SetCellValue("By CVE", fmt.Sprintf("B%d", r), item.Count)
		_ = f.SetCellValue("By CVE", fmt.Sprintf("C%d", r), joinStringSet(item.Projects, ", "))
		_ = f.SetCellValue("By CVE", fmt.Sprintf("D%d", r), severityLabel(item.MaxSev))
		_ = f.SetCellValue("By CVE", fmt.Sprintf("E%d", r), item.EPSS)
		_ = f.SetCellValue("By CVE", fmt.Sprintf("F%d", r), boolRU(item.InKEV))
		_ = f.SetCellValue("By CVE", fmt.Sprintf("G%d", r), boolRU(item.InBDU))
	}
}

func writeByComponentSheet(f *excelize.File, comp map[string]*compAgg) {
	headers := []string{"component@version", "findings_count", "max_severity", "has_fixed_version", "projects"}
	for i, h := range headers {
		c, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue("By Component", c, h)
	}
	type row struct {
		Key string
		*compAgg
	}
	rows := make([]row, 0, len(comp))
	for k, v := range comp {
		rows = append(rows, row{Key: k, compAgg: v})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Count > rows[j].Count })
	for idx, item := range rows {
		r := idx + 2
		_ = f.SetCellValue("By Component", fmt.Sprintf("A%d", r), item.Key)
		_ = f.SetCellValue("By Component", fmt.Sprintf("B%d", r), item.Count)
		_ = f.SetCellValue("By Component", fmt.Sprintf("C%d", r), severityLabel(item.MaxSev))
		_ = f.SetCellValue("By Component", fmt.Sprintf("D%d", r), boolRU(item.HasFixed))
		_ = f.SetCellValue("By Component", fmt.Sprintf("E%d", r), joinStringSet(item.Projects, ", "))
	}
}

func writeAboutSheet(f *excelize.File, version string, total int, filters map[string]any) {
	_ = f.SetCellValue("About", "A1", "Platform")
	_ = f.SetCellValue("About", "B1", "Red Lycoris")
	_ = f.SetCellValue("About", "A2", "Version")
	_ = f.SetCellValue("About", "B2", version)
	_ = f.SetCellValue("About", "A3", "Exported rows")
	_ = f.SetCellValue("About", "B3", total)
	buf, _ := json.Marshal(filters)
	sum := sha256.Sum256(buf)
	_ = f.SetCellValue("About", "A4", "Filters hash")
	_ = f.SetCellValue("About", "B4", hex.EncodeToString(sum[:]))
	_ = f.SetCellValue("About", "A6", "Документ содержит информацию об уязвимостях. Обращаться согласно внутренним политикам безопасности.")
}

func joinStringSet(m map[string]struct{}, sep string) string {
	arr := make([]string, 0, len(m))
	for k := range m {
		if strings.TrimSpace(k) != "" {
			arr = append(arr, k)
		}
	}
	sort.Strings(arr)
	return strings.Join(arr, sep)
}
