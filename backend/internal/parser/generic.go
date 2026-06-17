package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"redlycoris/internal/domain"
)

// flexSeverity accepts both numeric (0-4, clamped) and string severity values.
type flexSeverity int

func (s *flexSeverity) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var str string
		if err := json.Unmarshal(data, &str); err != nil {
			return err
		}
		*s = flexSeverity(parseSeverityString(str))
		return nil
	}
	var n int
	if err := json.Unmarshal(data, &n); err != nil {
		return err
	}
	*s = flexSeverity(clampInt(n, 0, 4))
	return nil
}

func parseSeverityString(s string) int {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "critical", "crit":
		return domain.SeverityCritical
	case "high":
		return domain.SeverityHigh
	case "medium", "moderate":
		return domain.SeverityMedium
	case "low":
		return domain.SeverityLow
	default: // info, informational, none, unknown, etc.
		return domain.SeverityInfo
	}
}

// flexConfidence accepts both numeric (0-3, clamped) and string confidence values.
type flexConfidence int

func (c *flexConfidence) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var str string
		if err := json.Unmarshal(data, &str); err != nil {
			return err
		}
		switch strings.ToLower(strings.TrimSpace(str)) {
		case "confirmed":
			*c = 3
		case "high":
			*c = 2
		case "medium":
			*c = 1
		default: // low, unknown, etc.
			*c = 0
		}
		return nil
	}
	var n int
	if err := json.Unmarshal(data, &n); err != nil {
		return err
	}
	*c = flexConfidence(clampInt(n, 0, 3))
	return nil
}

// flexStatus accepts both numeric (0-4, clamped) and string status values.
type flexStatus int

func (s *flexStatus) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var str string
		if err := json.Unmarshal(data, &str); err != nil {
			return err
		}
		switch strings.ToLower(strings.TrimSpace(str)) {
		case "risk_accepted", "accepted":
			*s = domain.StatusRiskAccepted
		case "resolved", "fixed":
			*s = domain.StatusResolved
		case "false_positive", "fp":
			*s = domain.StatusFP
		case "confirmed":
			*s = domain.StatusConfirmed
		default: // open, etc.
			*s = domain.StatusOpen
		}
		return nil
	}
	var n int
	if err := json.Unmarshal(data, &n); err != nil {
		return err
	}
	*s = flexStatus(clampInt(n, 0, 4))
	return nil
}

// flexCWEIDs accepts both []int and []string (e.g. "CWE-79", "79") in any mix.
type flexCWEIDs []int

func (f *flexCWEIDs) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	result := make([]int, 0, len(raw))
	for _, item := range raw {
		var n int
		if err := json.Unmarshal(item, &n); err == nil {
			result = append(result, n)
			continue
		}
		var str string
		if err := json.Unmarshal(item, &str); err != nil {
			continue
		}
		normalized := strings.TrimPrefix(strings.ToUpper(strings.TrimSpace(str)), "CWE-")
		if id, err := strconv.Atoi(normalized); err == nil {
			result = append(result, id)
		}
	}
	*f = result
	return nil
}

func clampInt(n, min, max int) int {
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}

// genericReport is our universal JSON import format.
type genericReport struct {
	ProjectID  *uuid.UUID       `json:"project_id"`
	SourceType string           `json:"source_type"`
	Findings   []genericFinding `json:"findings"`
}

type genericFinding struct {
	Kind             string          `json:"kind"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	Severity         flexSeverity    `json:"severity"`
	Confidence       flexConfidence  `json:"confidence"`
	Status           flexStatus      `json:"status"`
	FilePath         string          `json:"file_path"`
	LineStart        int             `json:"line_start"`
	LineEnd          int             `json:"line_end"`
	Component        string          `json:"component"`
	ComponentVersion string          `json:"component_version"`
	CVEIDs           []string        `json:"cve_ids"`
	CWEIDs           flexCWEIDs      `json:"cwe_ids"`
	CPEURI           string          `json:"cpe_uri"`
	FixedVersion     *string         `json:"fixed_version,omitempty"`
	PackageEcosystem *string         `json:"package_ecosystem,omitempty"`
	Purl             *string         `json:"purl,omitempty"`
	CodeSnippet      *string         `json:"code_snippet,omitempty"`
	CodeFlow         json.RawMessage `json:"code_flow,omitempty"`
	URL              *string         `json:"url,omitempty"`
	HTTPMethod       *string         `json:"http_method,omitempty"`
	HTTPParam        *string         `json:"http_param,omitempty"`
	HTTPEvidence     json.RawMessage `json:"http_evidence,omitempty"`
	IacResource      *string         `json:"iac_resource,omitempty"`
	IacProvider      *string         `json:"iac_provider,omitempty"`
	SecretKind       *string         `json:"secret_kind,omitempty"`
	CommitSHA        *string         `json:"commit_sha,omitempty"`
	RuleID           *string         `json:"rule_id,omitempty"`
	RuleName         *string         `json:"rule_name,omitempty"`
	// SourceType overrides the report-level source_type for this specific finding.
	SourceType *string `json:"source_type,omitempty"`
}

type GenericParser struct{}

func (p *GenericParser) CanParse(data []byte) bool {
	var probe struct {
		SourceType string `json:"source_type"`
		Findings   []any  `json:"findings"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}
	// project_id is intentionally NOT required here: handleImport can supply it
	// via query param after parsing. Generic stays last in detect.go to avoid
	// conflicts with SARIF/Trivy/etc. which lack both source_type and findings[].
	return probe.SourceType != "" && probe.Findings != nil
}

func (p *GenericParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	var report genericReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.GenericParser.Parse: unmarshal: %w", err)
	}

	findings := make([]domain.Finding, 0, len(report.Findings))

	for _, item := range report.Findings {
		kind := domain.KindOther
		if strings.TrimSpace(item.Kind) != "" {
			if parsed, ok := domain.ParseFindingKind(item.Kind); ok {
				kind = parsed
			}
		}

		sourceType := report.SourceType
		if item.SourceType != nil && *item.SourceType != "" {
			sourceType = *item.SourceType
		}

		var projectID uuid.UUID
		if report.ProjectID != nil {
			projectID = *report.ProjectID
		}

		f := domain.Finding{
			Kind:             kind,
			Title:            item.Title,
			Description:      item.Description,
			Severity:         int(item.Severity),
			Confidence:       int(item.Confidence),
			Status:           int(item.Status),
			FilePath:         item.FilePath,
			LineStart:        item.LineStart,
			LineEnd:          item.LineEnd,
			Component:        item.Component,
			ComponentVersion: item.ComponentVersion,
			CVEIDs:           item.CVEIDs,
			CWEIDs:           []int(item.CWEIDs),
			CPEURI:           item.CPEURI,
			FixedVersion:     item.FixedVersion,
			PackageEcosystem: item.PackageEcosystem,
			Purl:             item.Purl,
			CodeSnippet:      item.CodeSnippet,
			CodeFlow:         item.CodeFlow,
			URL:              item.URL,
			HTTPMethod:       item.HTTPMethod,
			HTTPParam:        item.HTTPParam,
			HTTPEvidence:     item.HTTPEvidence,
			IacResource:      item.IacResource,
			IacProvider:      item.IacProvider,
			SecretKind:       item.SecretKind,
			CommitSHA:        item.CommitSHA,
			RuleID:           item.RuleID,
			RuleName:         item.RuleName,
			ProjectID:        projectID,
			SourceType:       sourceType,
		}
		if f.CVEIDs == nil {
			f.CVEIDs = []string{}
		}
		if f.CWEIDs == nil {
			f.CWEIDs = []int{}
		}
		f.Fingerprint = domain.CalculateFingerprint(&f)
		findings = append(findings, f)
	}

	return findings, nil
}
