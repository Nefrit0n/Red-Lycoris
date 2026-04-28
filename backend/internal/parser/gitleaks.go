package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"redlycoris/internal/domain"
)

type gitleaksFinding struct {
	RuleID      string `json:"RuleID"`
	Description string `json:"Description"`
	File        string `json:"File"`
	StartLine   int    `json:"StartLine"`
	EndLine     int    `json:"EndLine"`
	Commit      string `json:"Commit"`
	Author      string `json:"Author"`
	Match       string `json:"Match"`
	Secret      string `json:"Secret"`
}

type GitleaksParser struct{}

func (p *GitleaksParser) CanParse(data []byte) bool {
	var probe []gitleaksFinding
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}
	if len(probe) == 0 {
		return false
	}
	first := probe[0]
	return strings.TrimSpace(first.RuleID) != "" && strings.TrimSpace(first.Commit) != "" && strings.TrimSpace(first.Match) != ""
}

func (p *GitleaksParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	var report []gitleaksFinding
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.GitleaksParser.Parse: unmarshal: %w", err)
	}

	findings := make([]domain.Finding, 0, len(report))
	for _, item := range report {
		ruleID := strings.TrimSpace(item.RuleID)
		description := strings.TrimSpace(item.Description)
		if description == "" {
			description = "Potential secret detected"
		}

		commit := strings.TrimSpace(item.Commit)
		shortCommit := commit
		if len(shortCommit) > 8 {
			shortCommit = shortCommit[:8]
		}

		ruleIDPtr := emptyToNil(ruleID)
		ruleNamePtr := emptyToNil(description)
		secretKind := emptyToNil(ruleID)
		commitSHA := emptyToNil(commit)

		f := domain.Finding{
			Kind:  domain.KindSecrets,
			Title: description,
			Description: fmt.Sprintf("Secret in commit %s by %s: %s",
				shortCommit,
				strings.TrimSpace(item.Author),
				maskSecret(item.Match),
			),
			Severity:   domain.SeverityHigh,
			Confidence: 2,
			Status:     domain.StatusOpen,
			FilePath:   strings.TrimSpace(item.File),
			LineStart:  item.StartLine,
			LineEnd:    item.EndLine,
			RuleID:     ruleIDPtr,
			RuleName:   ruleNamePtr,
			SecretKind: secretKind,
			CommitSHA:  commitSHA,
			CVEIDs:     []string{},
			CWEIDs:     []int{},
			SourceType: "gitleaks",
		}
		secretValue := strings.TrimSpace(item.Secret)
		if secretValue == "" {
			secretValue = strings.TrimSpace(item.Match)
		}
		if secretKind != nil && secretValue != "" {
			fp := domain.ComputeSecretFingerprint(*secretKind, secretValue)
			f.SecretFingerprint = &fp
		}
		f.Fingerprint = domain.CalculateFingerprint(&f)
		findings = append(findings, f)
	}

	return findings, nil
}

func maskSecret(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 8 {
		return "***"
	}
	return value[:4] + "..." + value[len(value)-4:]
}
