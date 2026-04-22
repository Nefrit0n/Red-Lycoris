package export

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/net/html"

	"redlycoris/internal/domain"
)

func mkFinding(i int) domain.Finding {
	return domain.Finding{
		ID:         uuid.New(),
		Title:      "Finding title",
		Severity:   domain.SeverityHigh,
		Status:     domain.StatusOpen,
		CVEIDs:     []string{"CVE-2026-0001"},
		Component:  "openssl",
		SourceType: "sca",
		FirstSeen:  time.Now().Add(-24 * time.Hour),
		LastSeen:   time.Now(),
	}
}

func TestRenderHTMLReport_Basic(t *testing.T) {
	items := make([]domain.Finding, 10)
	for i := range items {
		items[i] = mkFinding(i)
	}
	body, err := RenderHTMLReport(ReportData{HeaderTitle: "Все проекты", Summary: BuildSummary(items), StatusRows: BuildStatusRows(items), TableFindings: items, DetailFindings: items, TopCVEs: BuildTopCVEs(items, 20, nil), Components: BuildComponents(items, 100)}, ReportOptions{GeneratedAt: time.Now(), Platform: "v1", IncludeDetails: true})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if _, err := html.Parse(strings.NewReader(string(body))); err != nil {
		t.Fatalf("parse html: %v", err)
	}
	for _, h := range []string{"Executive summary", "Все findings", "Детали", "О выгрузке"} {
		if !strings.Contains(string(body), h) {
			t.Fatalf("missing heading %q", h)
		}
	}
}

func TestRenderHTMLReport_NoDetails(t *testing.T) {
	items := make([]domain.Finding, 1000)
	for i := range items {
		items[i] = mkFinding(i)
	}
	body, err := RenderHTMLReport(ReportData{HeaderTitle: "Все проекты", Summary: BuildSummary(items), StatusRows: BuildStatusRows(items), TableFindings: items, DetailFindings: items, TopCVEs: BuildTopCVEs(items, 20, nil), Components: BuildComponents(items, 100)}, ReportOptions{GeneratedAt: time.Now(), Platform: "v1", IncludeDetails: false})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if strings.Contains(string(body), "Детали ·") {
		t.Fatal("details block should be hidden")
	}
	if len(body) > 1_000_000 {
		t.Fatalf("html too large: %d", len(body))
	}
}

func TestRenderHTMLReport_Escaping(t *testing.T) {
	f := mkFinding(1)
	f.Title = "<script>alert(1)</script>"
	body, err := RenderHTMLReport(ReportData{HeaderTitle: "t", Summary: BuildSummary([]domain.Finding{f}), StatusRows: BuildStatusRows([]domain.Finding{f}), TableFindings: []domain.Finding{f}, TopCVEs: BuildTopCVEs([]domain.Finding{f}, 20, nil), Components: BuildComponents([]domain.Finding{f}, 100)}, ReportOptions{GeneratedAt: time.Now(), Platform: "v1"})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	s := string(body)
	if strings.Contains(s, "<script>alert(1)</script>") {
		t.Fatal("script tag must be escaped")
	}
	if !strings.Contains(s, "&lt;script&gt;alert(1)&lt;/script&gt;") {
		t.Fatal("escaped title expected")
	}
}

func TestRenderHTMLReport_AutoHiddenWarning(t *testing.T) {
	items := make([]domain.Finding, 600)
	for i := range items {
		items[i] = mkFinding(i)
	}
	body, err := RenderHTMLReport(
		ReportData{HeaderTitle: "Все проекты", Summary: BuildSummary(items), StatusRows: BuildStatusRows(items), TableFindings: items, TopCVEs: BuildTopCVEs(items, 20, nil), Components: BuildComponents(items, 100)},
		ReportOptions{GeneratedAt: time.Now(), Platform: "v1", IncludeDetails: false, DetailsAutoHidden: true},
	)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if !strings.Contains(string(body), "детали скрыты из-за объёма") {
		t.Fatal("expected auto hidden warning")
	}
}
