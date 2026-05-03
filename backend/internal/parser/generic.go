package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"redlycoris/internal/domain"
)

// genericReport is our universal JSON import format.
type genericReport struct {
	ProjectID  uuid.UUID        `json:"project_id"`
	SourceType string           `json:"source_type"`
	Findings   []genericFinding `json:"findings"`
}

type genericFinding struct {
	Kind             string          `json:"kind"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	Severity         int             `json:"severity"`
	Confidence       int             `json:"confidence"`
	FilePath         string          `json:"file_path"`
	LineStart        int             `json:"line_start"`
	LineEnd          int             `json:"line_end"`
	Component        string          `json:"component"`
	ComponentVersion string          `json:"component_version"`
	CVEIDs           []string        `json:"cve_ids"`
	CWEIDs           []int           `json:"cwe_ids"`
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
}

type GenericParser struct{}

func (p *GenericParser) CanParse(data []byte) bool {
	var probe struct {
		ProjectID  *uuid.UUID `json:"project_id"`
		SourceType string     `json:"source_type"`
		Findings   []any      `json:"findings"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}
	return probe.ProjectID != nil && probe.SourceType != "" && probe.Findings != nil
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

		f := domain.Finding{
			Kind:             kind,
			Title:            item.Title,
			Description:      item.Description,
			Severity:         item.Severity,
			Confidence:       item.Confidence,
			Status:           domain.StatusOpen,
			FilePath:         item.FilePath,
			LineStart:        item.LineStart,
			LineEnd:          item.LineEnd,
			Component:        item.Component,
			ComponentVersion: item.ComponentVersion,
			CVEIDs:           item.CVEIDs,
			CWEIDs:           item.CWEIDs,
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
			ProjectID:        report.ProjectID,
			SourceType:       report.SourceType,
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
