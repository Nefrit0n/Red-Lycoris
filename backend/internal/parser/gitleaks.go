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

type gitleaksEnvelope struct {
	Findings []gitleaksFinding `json:"findings"`
	Leaks    []gitleaksFinding `json:"leaks"`
	Results  []gitleaksFinding `json:"results"`
}

type GitleaksParser struct{}

func (p *GitleaksParser) CanParse(data []byte) bool {
	probe, ok := decodeGitleaksFindings(data)
	if !ok {
		return false
	}
	if len(probe) == 0 {
		return false
	}
	first := probe[0]
	return strings.TrimSpace(first.RuleID) != "" && (strings.TrimSpace(first.Match) != "" || strings.TrimSpace(first.Secret) != "")
}

func (p *GitleaksParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	report, ok := decodeGitleaksFindings(data)
	if !ok {
		return nil, fmt.Errorf("parser.GitleaksParser.Parse: unmarshal: unsupported gitleaks payload")
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

		// Compute secret fingerprint from the actual secret value so secrets
		// with the same value collapse into one group regardless of location.
		var secretFP *string
		if secretVal := strings.TrimSpace(item.Secret); secretVal != "" {
			fp := domain.ComputeSecretFingerprint(ruleID, secretVal)
			secretFP = &fp
		}

		f := domain.Finding{
			Kind:              domain.KindSecrets,
			Title:             description,
			Description:       buildGitleaksDescription(shortCommit, strings.TrimSpace(item.Author), item.Match, item.Secret),
			Severity:          domain.SeverityHigh,
			Confidence:        2,
			Status:            domain.StatusOpen,
			FilePath:          strings.TrimSpace(item.File),
			LineStart:         item.StartLine,
			LineEnd:           item.EndLine,
			RuleID:            ruleIDPtr,
			RuleName:          ruleNamePtr,
			SecretKind:        secretKind,
			CommitSHA:         commitSHA,
			SecretFingerprint: secretFP,
			CVEIDs:            []string{},
			CWEIDs:            []int{},
			SourceType:        "gitleaks",
		}
		f.Fingerprint = domain.CalculateFingerprint(&f)
		findings = append(findings, f)
	}

	return findings, nil
}

func decodeGitleaksFindings(data []byte) ([]gitleaksFinding, bool) {
	var asList []gitleaksFinding
	if err := json.Unmarshal(data, &asList); err == nil {
		return asList, true
	}

	var asEnvelope gitleaksEnvelope
	if err := json.Unmarshal(data, &asEnvelope); err != nil {
		return nil, false
	}

	for _, collection := range [][]gitleaksFinding{asEnvelope.Findings, asEnvelope.Leaks, asEnvelope.Results} {
		if len(collection) > 0 {
			return collection, true
		}
	}

	if asEnvelope.Findings != nil {
		return asEnvelope.Findings, true
	}
	if asEnvelope.Leaks != nil {
		return asEnvelope.Leaks, true
	}
	if asEnvelope.Results != nil {
		return asEnvelope.Results, true
	}

	return nil, false
}

func maskSecret(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 8 {
		return "***"
	}
	return value[:4] + "..." + value[len(value)-4:]
}

func buildGitleaksDescription(shortCommit, author, match, secret string) string {
	secretValue := strings.TrimSpace(match)
	if secretValue == "" {
		secretValue = strings.TrimSpace(secret)
	}
	masked := maskSecret(secretValue)
	if shortCommit == "" {
		if author == "" {
			return fmt.Sprintf("Secret detected: %s", masked)
		}
		return fmt.Sprintf("Secret detected by %s: %s", author, masked)
	}
	if author == "" {
		return fmt.Sprintf("Secret in commit %s: %s", shortCommit, masked)
	}
	return fmt.Sprintf("Secret in commit %s by %s: %s", shortCommit, author, masked)
}
