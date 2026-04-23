package export

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"io"
	"sort"
	"strings"
	"time"

	"redlycoris/internal/domain"
)

//go:embed templates/report.html.tmpl
var reportTemplate string

const (
	MaxHTMLRows       = 5000
	MaxHTMLDetailRows = 500
)

type ReportOptions struct {
	Title             string
	GeneratedAt       time.Time
	AuthorEmail       string
	Platform          string
	FiltersJSON       string
	IncludeDetails    bool
	DetailsAutoHidden bool
	DetailsHidden     int
	FilterChips       []string
	BDUByCVE          map[string]string
}

type CVEGroup struct {
	CVE         string
	Findings    int
	MaxSeverity int
	InKEV       bool
	EPSS        *float64
	Title       string
	Scanners    string
	Components  string
	BDU         string
}

type ComponentGroup struct {
	Name        string
	Version     string
	Findings    int
	MaxSeverity int
	FixVersion  string
}

type ReportData struct {
	HeaderTitle    string
	Summary        Summary
	TableFindings  []domain.Finding
	DetailFindings []domain.Finding
	StatusRows     []StatusRow
	TopCVEs        []CVEGroup
	Components     []ComponentGroup
}

type Summary struct {
	Total        int
	CriticalOpen int
	InKEV        int
	HasFix       int
	HasFixPct    string
	Severity     map[string]int
}

type SeveritySegment struct {
	Key   string
	Label string
	Color string
	Count int
	Width string
}

type StatusRow struct {
	Label   string
	Count   int
	Percent string
}

type reportView struct {
	Title             string
	GeneratedAt       string
	AuthorEmail       string
	Platform          string
	HeaderTitle       string
	Summary           Summary
	SeveritySegments  []SeveritySegment
	StatusRows        []StatusRow
	TableFindings     []domain.Finding
	DetailFindings    []domain.Finding
	IncludeDetails    bool
	DetailsAutoHidden bool
	DetailsHidden     int
	FiltersJSON       string
	FilterChips       []string
	TopCVEs           []CVEGroup
	Components        []ComponentGroup
	BDUByCVE          map[string]string
}

func RenderHTMLReport(data ReportData, opts ReportOptions) ([]byte, error) {
	var out bytes.Buffer
	if err := ExecuteHTMLReport(&out, data, opts); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func ExecuteHTMLReport(w io.Writer, data ReportData, opts ReportOptions) error {
	tpl, err := template.New("report").Funcs(template.FuncMap{
		"sevClass":    sevClass,
		"sevLabel":    sevLabelRU,
		"statusLabel": statusLabelRU,
		"firstCVE":    firstCVE,
		"lineRef":     lineRef,
		"percent":     percent,
		"epss":        epssPercent,
		"bduByCVE":    func(cve string) string { return opts.BDUByCVE[cve] },
		"cleanText":   cleanText,
	}).Parse(reportTemplate)
	if err != nil {
		return err
	}

	view := reportView{
		Title:             fallbackTitle(opts.Title, data.HeaderTitle),
		GeneratedAt:       opts.GeneratedAt.Local().Format("2006-01-02 15:04:05 MST"),
		AuthorEmail:       opts.AuthorEmail,
		Platform:          opts.Platform,
		HeaderTitle:       data.HeaderTitle,
		Summary:           data.Summary,
		SeveritySegments:  severitySegments(data.Summary),
		StatusRows:        data.StatusRows,
		TableFindings:     data.TableFindings,
		DetailFindings:    data.DetailFindings,
		IncludeDetails:    opts.IncludeDetails,
		DetailsAutoHidden: opts.DetailsAutoHidden,
		DetailsHidden:     opts.DetailsHidden,
		FiltersJSON:       opts.FiltersJSON,
		FilterChips:       opts.FilterChips,
		TopCVEs:           data.TopCVEs,
		Components:        data.Components,
		BDUByCVE:          opts.BDUByCVE,
	}

	if err := tpl.Execute(w, view); err != nil {
		return err
	}
	return nil
}

func BuildSummary(findings []domain.Finding) Summary {
	s := Summary{Severity: map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}}
	s.Total = len(findings)
	for _, f := range findings {
		sev := strings.ToLower(sevLabelEN(f.Severity))
		s.Severity[sev]++
		if f.InKEV {
			s.InKEV++
		}
		if f.FixedVersion != nil && strings.TrimSpace(*f.FixedVersion) != "" {
			s.HasFix++
		}
		if f.Severity == domain.SeverityCritical && f.Status == domain.StatusOpen {
			s.CriticalOpen++
		}
	}
	s.HasFixPct = percent(s.HasFix, s.Total)
	return s
}

func BuildStatusRows(findings []domain.Finding) []StatusRow {
	counts := map[int]int{}
	for _, f := range findings {
		counts[f.Status]++
	}
	order := []int{domain.StatusOpen, domain.StatusConfirmed, domain.StatusFP, domain.StatusResolved, domain.StatusRiskAccepted}
	rows := make([]StatusRow, 0, len(order))
	for _, status := range order {
		count := counts[status]
		rows = append(rows, StatusRow{Label: statusLabelRU(status), Count: count, Percent: percent(count, len(findings))})
	}
	return rows
}

func BuildTopCVEs(findings []domain.Finding, limit int, bduByCVE map[string]string) []CVEGroup {
	type agg struct {
		count      int
		maxSev     int
		inKEV      bool
		epss       *float64
		title      string
		scanners   map[string]struct{}
		components map[string]struct{}
	}
	m := map[string]*agg{}
	for _, f := range findings {
		if len(f.CVEIDs) == 0 {
			continue
		}
		for _, cve := range f.CVEIDs {
			a, ok := m[cve]
			if !ok {
				a = &agg{maxSev: -1, scanners: map[string]struct{}{}, components: map[string]struct{}{}}
				m[cve] = a
			}
			a.count++
			if f.Severity > a.maxSev {
				a.maxSev = f.Severity
			}
			a.inKEV = a.inKEV || f.InKEV
			if a.epss == nil && f.MaxEPSS != nil {
				v := *f.MaxEPSS
				a.epss = &v
			} else if a.epss != nil && f.MaxEPSS != nil && *f.MaxEPSS > *a.epss {
				v := *f.MaxEPSS
				a.epss = &v
			}
			if a.title == "" {
				a.title = f.Title
			}
			a.scanners[f.SourceType] = struct{}{}
			if f.Component != "" {
				a.components[f.Component] = struct{}{}
			}
		}
	}
	out := make([]CVEGroup, 0, len(m))
	for cve, a := range m {
		out = append(out, CVEGroup{
			CVE:         cve,
			Findings:    a.count,
			MaxSeverity: a.maxSev,
			InKEV:       a.inKEV,
			EPSS:        a.epss,
			Title:       a.title,
			Scanners:    joinSet(a.scanners, 3),
			Components:  joinSet(a.components, 4),
			BDU:         bduByCVE[cve],
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].MaxSeverity == out[j].MaxSeverity {
			return out[i].Findings > out[j].Findings
		}
		return out[i].MaxSeverity > out[j].MaxSeverity
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

func BuildComponents(findings []domain.Finding, limit int) []ComponentGroup {
	type agg struct {
		count   int
		maxSev  int
		fixVer  string
		version string
	}
	m := map[string]*agg{}
	for _, f := range findings {
		if f.Component == "" {
			continue
		}
		key := f.Component + "\x1f" + f.ComponentVersion
		a, ok := m[key]
		if !ok {
			a = &agg{maxSev: -1, version: f.ComponentVersion}
			m[key] = a
		}
		a.count++
		if f.Severity > a.maxSev {
			a.maxSev = f.Severity
		}
		if a.fixVer == "" && f.FixedVersion != nil {
			a.fixVer = *f.FixedVersion
		}
	}
	out := make([]ComponentGroup, 0, len(m))
	for k, a := range m {
		parts := strings.SplitN(k, "\x1f", 2)
		fix := "—"
		if strings.TrimSpace(a.fixVer) != "" {
			fix = a.fixVer
		}
		out = append(out, ComponentGroup{Name: parts[0], Version: a.version, Findings: a.count, MaxSeverity: a.maxSev, FixVersion: fix})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Findings == out[j].Findings {
			return out[i].MaxSeverity > out[j].MaxSeverity
		}
		return out[i].Findings > out[j].Findings
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

func severitySegments(summary Summary) []SeveritySegment {
	defs := []struct {
		k, l, c string
	}{
		{"critical", "Critical", "#A32D2D"},
		{"high", "High", "#BA7517"},
		{"medium", "Medium", "#EF9F27"},
		{"low", "Low", "#378ADD"},
		{"info", "Info", "#888780"},
	}
	out := make([]SeveritySegment, 0, len(defs))
	for _, d := range defs {
		count := summary.Severity[d.k]
		out = append(out, SeveritySegment{Key: d.k, Label: d.l, Color: d.c, Count: count, Width: percent(count, summary.Total)})
	}
	return out
}

func joinSet(m map[string]struct{}, limit int) string {
	if len(m) == 0 {
		return "—"
	}
	vals := make([]string, 0, len(m))
	for v := range m {
		vals = append(vals, v)
	}
	sort.Strings(vals)
	if len(vals) > limit {
		return strings.Join(vals[:limit], ", ") + fmt.Sprintf(" +%d", len(vals)-limit)
	}
	return strings.Join(vals, ", ")
}

func epssPercent(v *float64) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%.1f%%", (*v)*100)
}

func cleanText(s string) string {
	s = strings.ReplaceAll(s, "**", "")
	s = strings.ReplaceAll(s, "###", "")
	s = strings.ReplaceAll(s, "##", "")
	s = strings.ReplaceAll(s, "`", "")
	if len(s) > 8000 {
		s = s[:8000] + "…"
	}
	return s
}

func fallbackTitle(custom, generated string) string {
	if strings.TrimSpace(custom) != "" {
		return custom
	}
	if strings.TrimSpace(generated) != "" {
		return generated
	}
	return "Отчёт по уязвимостям Red Lycoris"
}

func sevClass(sev int) string {
	switch sev {
	case domain.SeverityCritical:
		return "sev-critical"
	case domain.SeverityHigh:
		return "sev-high"
	case domain.SeverityMedium:
		return "sev-medium"
	case domain.SeverityLow:
		return "sev-low"
	default:
		return "sev-info"
	}
}

func sevLabelRU(sev int) string {
	switch sev {
	case domain.SeverityCritical:
		return "Критическая"
	case domain.SeverityHigh:
		return "Высокая"
	case domain.SeverityMedium:
		return "Средняя"
	case domain.SeverityLow:
		return "Низкая"
	default:
		return "Инфо"
	}
}

func statusLabelRU(status int) string {
	switch status {
	case domain.StatusOpen:
		return "Открыта"
	case domain.StatusConfirmed:
		return "Подтверждена"
	case domain.StatusFP:
		return "Ложное"
	case domain.StatusResolved:
		return "Исправлена"
	default:
		return "Принят риск"
	}
}

func firstCVE(v []string) string {
	if len(v) == 0 {
		return "—"
	}
	return v[0]
}

func lineRef(path string, line int) string {
	if strings.TrimSpace(path) == "" {
		return "—"
	}
	if line <= 0 {
		return path
	}
	return fmt.Sprintf("%s:%d", path, line)
}

func percent(a, b int) string {
	if b == 0 {
		return "0.0%"
	}
	return fmt.Sprintf("%.1f%%", float64(a)*100/float64(b))
}

func sevLabelEN(sev int) string {
	switch sev {
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
