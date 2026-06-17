package parser

import (
	"context"
	"testing"

	"redlycoris/internal/domain"
)

// ---------------------------------------------------------------------------
// flexSeverity
// ---------------------------------------------------------------------------

func TestFlexSeverity_StringValues(t *testing.T) {
	cases := []struct {
		input string
		want  int
	}{
		{`"critical"`, domain.SeverityCritical},
		{`"crit"`, domain.SeverityCritical},
		{`"high"`, domain.SeverityHigh},
		{`"medium"`, domain.SeverityMedium},
		{`"moderate"`, domain.SeverityMedium},
		{`"low"`, domain.SeverityLow},
		{`"info"`, domain.SeverityInfo},
		{`"informational"`, domain.SeverityInfo},
		{`"none"`, domain.SeverityInfo},
		{`"weird"`, domain.SeverityInfo}, // unknown → 0, not an error
		{`"CRITICAL"`, domain.SeverityCritical},
	}
	for _, tc := range cases {
		var s flexSeverity
		if err := s.UnmarshalJSON([]byte(tc.input)); err != nil {
			t.Errorf("input %s: unexpected error: %v", tc.input, err)
			continue
		}
		if int(s) != tc.want {
			t.Errorf("input %s: got %d, want %d", tc.input, int(s), tc.want)
		}
	}
}

func TestFlexSeverity_IntValues(t *testing.T) {
	cases := []struct{ input, want int }{{3, 3}, {0, 0}, {4, 4}, {-1, 0}, {99, 4}}
	for _, tc := range cases {
		raw := []byte(string(rune('0' + tc.input)))
		if tc.input < 0 {
			raw = []byte("-1")
		}
		if tc.input > 9 {
			raw = []byte("99")
		}
		var s flexSeverity
		if err := s.UnmarshalJSON(raw); err != nil {
			t.Errorf("input %d: unexpected error: %v", tc.input, err)
			continue
		}
		if int(s) != tc.want {
			t.Errorf("input %d: got %d, want %d", tc.input, int(s), tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// flexConfidence
// ---------------------------------------------------------------------------

func TestFlexConfidence_StringValues(t *testing.T) {
	cases := []struct {
		input string
		want  int
	}{
		{`"low"`, 0},
		{`"medium"`, 1},
		{`"high"`, 2},
		{`"confirmed"`, 3},
		{`"unknown"`, 0},
	}
	for _, tc := range cases {
		var c flexConfidence
		if err := c.UnmarshalJSON([]byte(tc.input)); err != nil {
			t.Errorf("input %s: unexpected error: %v", tc.input, err)
			continue
		}
		if int(c) != tc.want {
			t.Errorf("input %s: got %d, want %d", tc.input, int(c), tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// flexStatus
// ---------------------------------------------------------------------------

func TestFlexStatus_StringValues(t *testing.T) {
	cases := []struct {
		input string
		want  int
	}{
		{`"open"`, domain.StatusOpen},
		{`"confirmed"`, domain.StatusConfirmed},
		{`"false_positive"`, domain.StatusFP},
		{`"fp"`, domain.StatusFP},
		{`"resolved"`, domain.StatusResolved},
		{`"fixed"`, domain.StatusResolved},
		{`"risk_accepted"`, domain.StatusRiskAccepted},
		{`"accepted"`, domain.StatusRiskAccepted},
		{`"unknown"`, domain.StatusOpen},
	}
	for _, tc := range cases {
		var s flexStatus
		if err := s.UnmarshalJSON([]byte(tc.input)); err != nil {
			t.Errorf("input %s: unexpected error: %v", tc.input, err)
			continue
		}
		if int(s) != tc.want {
			t.Errorf("input %s: got %d, want %d", tc.input, int(s), tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// flexCWEIDs
// ---------------------------------------------------------------------------

func TestFlexCWEIDs(t *testing.T) {
	cases := []struct {
		input string
		want  []int
	}{
		{`[79, 89]`, []int{79, 89}},
		{`["CWE-79", "cwe-89"]`, []int{79, 89}},
		{`["CWE-79", "89"]`, []int{79, 89}},
		{`["79"]`, []int{79}},
		{`[]`, []int{}},
	}
	for _, tc := range cases {
		var ids flexCWEIDs
		if err := ids.UnmarshalJSON([]byte(tc.input)); err != nil {
			t.Errorf("input %s: unexpected error: %v", tc.input, err)
			continue
		}
		if len(ids) != len(tc.want) {
			t.Errorf("input %s: got len %d, want %d", tc.input, len(ids), len(tc.want))
			continue
		}
		for i := range ids {
			if int(ids[i]) != tc.want[i] {
				t.Errorf("input %s [%d]: got %d, want %d", tc.input, i, ids[i], tc.want[i])
			}
		}
	}
}

// ---------------------------------------------------------------------------
// CanParse
// ---------------------------------------------------------------------------

const genericMinimal = `{"source_type":"my-scanner","findings":[]}`
const genericWithProjectID = `{"project_id":"00000000-0000-0000-0000-000000000001","source_type":"my-scanner","findings":[]}`
const genericNoSourceType = `{"findings":[]}`
const genericNoFindings = `{"source_type":"my-scanner"}`

func TestGenericParser_CanParse(t *testing.T) {
	p := &GenericParser{}
	if !p.CanParse([]byte(genericMinimal)) {
		t.Error("expected CanParse=true for minimal generic (no project_id)")
	}
	if !p.CanParse([]byte(genericWithProjectID)) {
		t.Error("expected CanParse=true for generic with project_id")
	}
	if p.CanParse([]byte(genericNoSourceType)) {
		t.Error("expected CanParse=false when source_type absent")
	}
	if p.CanParse([]byte(genericNoFindings)) {
		t.Error("expected CanParse=false when findings absent")
	}
}

// Ensure generic does NOT intercept SARIF, Trivy, Grype.
const sarifFixtureSmall = `{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"test"}},"results":[]}]}`
const trivyFixtureSmall = `{"SchemaVersion":2,"Results":[]}`

func TestGenericParser_CanParse_NoFalsePositives(t *testing.T) {
	p := &GenericParser{}
	if p.CanParse([]byte(sarifFixtureSmall)) {
		t.Error("generic should not claim SARIF")
	}
	if p.CanParse([]byte(trivyFixtureSmall)) {
		t.Error("generic should not claim Trivy")
	}
}

// ---------------------------------------------------------------------------
// Phase 1 integration — Parse
// ---------------------------------------------------------------------------

func TestGenericParser_Parse_StringSeverity(t *testing.T) {
	payload := `{
		"source_type": "custom",
		"findings": [
			{"title": "SQL Injection", "severity": "critical", "kind": "sast"}
		]
	}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != domain.SeverityCritical {
		t.Errorf("expected severity 4 (critical), got %d", findings[0].Severity)
	}
}

func TestGenericParser_Parse_AbsentStatus(t *testing.T) {
	payload := `{"source_type":"custom","findings":[{"title":"X","severity":1}]}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if findings[0].Status != domain.StatusOpen {
		t.Errorf("expected status open (0), got %d", findings[0].Status)
	}
}

func TestGenericParser_Parse_StringStatus(t *testing.T) {
	payload := `{"source_type":"custom","findings":[{"title":"X","severity":1,"status":"fixed"}]}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if findings[0].Status != domain.StatusResolved {
		t.Errorf("expected status resolved (3), got %d", findings[0].Status)
	}
}

func TestGenericParser_Parse_AbsentConfidence(t *testing.T) {
	payload := `{"source_type":"custom","findings":[{"title":"X","severity":1}]}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if findings[0].Confidence != 0 {
		t.Errorf("expected confidence 0, got %d", findings[0].Confidence)
	}
}

func TestGenericParser_Parse_CWEMixedArray(t *testing.T) {
	payload := `{"source_type":"custom","findings":[{"title":"X","severity":1,"cwe_ids":["CWE-79","89"]}]}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cwe := findings[0].CWEIDs
	if len(cwe) != 2 || cwe[0] != 79 || cwe[1] != 89 {
		t.Errorf("unexpected cwe_ids: %v", cwe)
	}
}

func TestGenericParser_Parse_PerFindingSourceType(t *testing.T) {
	payload := `{
		"source_type": "report-level",
		"findings": [
			{"title": "A", "severity": 1, "source_type": "per-finding"},
			{"title": "B", "severity": 1}
		]
	}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if findings[0].SourceType != "per-finding" {
		t.Errorf("expected per-finding source_type, got %q", findings[0].SourceType)
	}
	if findings[1].SourceType != "report-level" {
		t.Errorf("expected report-level source_type, got %q", findings[1].SourceType)
	}
}

// ---------------------------------------------------------------------------
// Phase 2 — inferGenericKind
// ---------------------------------------------------------------------------

func TestInferGenericKind_Secrets(t *testing.T) {
	sk := "github-token"
	item := genericFinding{Title: "Leaked token", SecretKind: &sk}
	if got := inferGenericKind(item); got != domain.KindSecrets {
		t.Errorf("expected secrets, got %v", got)
	}
}

func TestInferGenericKind_IaC(t *testing.T) {
	res := "aws_s3_bucket"
	item := genericFinding{Title: "Open bucket", IacResource: &res}
	if got := inferGenericKind(item); got != domain.KindIaC {
		t.Errorf("expected iac, got %v", got)
	}
}

func TestInferGenericKind_DAST(t *testing.T) {
	u := "https://example.com/login"
	item := genericFinding{Title: "XSS", URL: &u}
	if got := inferGenericKind(item); got != domain.KindDAST {
		t.Errorf("expected dast, got %v", got)
	}
}

func TestInferGenericKind_SCA_CVE(t *testing.T) {
	item := genericFinding{
		Title:     "Log4Shell",
		CVEIDs:    []string{"CVE-2021-44228"},
		Component: "log4j",
	}
	if got := inferGenericKind(item); got != domain.KindSCA {
		t.Errorf("expected sca, got %v", got)
	}
}

func TestInferGenericKind_SAST(t *testing.T) {
	rule := "G101"
	item := genericFinding{Title: "Hardcoded creds", FilePath: "main.go", RuleID: &rule}
	if got := inferGenericKind(item); got != domain.KindSAST {
		t.Errorf("expected sast, got %v", got)
	}
}

func TestInferGenericKind_Other(t *testing.T) {
	item := genericFinding{Title: "Bare minimum", Severity: 2}
	if got := inferGenericKind(item); got != domain.KindOther {
		t.Errorf("expected other, got %v", got)
	}
}

func TestGenericParser_Parse_ExplicitKindBeatsInference(t *testing.T) {
	// Finding has SCA signals but explicit kind=sast — explicit must win.
	payload := `{
		"source_type": "custom",
		"findings": [{
			"title": "Log4j",
			"severity": 4,
			"kind": "sast",
			"cve_ids": ["CVE-2021-44228"],
			"component": "log4j"
		}]
	}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if findings[0].Kind != domain.KindSAST {
		t.Errorf("explicit kind should win: expected sast, got %v", findings[0].Kind)
	}
}

func TestGenericParser_Parse_KindInferredWhenAbsent(t *testing.T) {
	sk := "aws-key"
	payload := `{
		"source_type": "trufflehog-custom",
		"findings": [{
			"title": "AWS key",
			"severity": 3,
			"secret_kind": "aws-access-key-id",
			"commit_sha": "abc123"
		}]
	}`
	p := &GenericParser{}
	findings, err := p.Parse(context.Background(), []byte(payload))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = sk
	if findings[0].Kind != domain.KindSecrets {
		t.Errorf("expected secrets from inference, got %v", findings[0].Kind)
	}
}
