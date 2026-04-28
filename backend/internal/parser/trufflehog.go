package parser

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"

	"redlycoris/internal/domain"
)

type trufflehogFinding struct {
	SourceMetadata        trufflehogSourceMetadata `json:"SourceMetadata"`
	SourceType            int                      `json:"SourceType"`
	SourceName            string                   `json:"SourceName"`
	DetectorType          int                      `json:"DetectorType"`
	DetectorName          string                   `json:"DetectorName"`
	DetectorDescription   string                   `json:"DetectorDescription"`
	DecoderName           string                   `json:"DecoderName"`
	Verified              bool                     `json:"Verified"`
	VerificationFromCache bool                     `json:"VerificationFromCache"`
	Raw                   string                   `json:"Raw"`
	RawV2                 string                   `json:"RawV2"`
	Redacted              string                   `json:"Redacted"`
	ExtraData             map[string]string        `json:"ExtraData"`
}

type trufflehogSourceMetadata struct {
	Data map[string]json.RawMessage `json:"Data"`
}

type trufflehogFilesystemMeta struct {
	File string `json:"file"`
	Line int    `json:"line"`
}

type trufflehogGitMeta struct {
	Commit     string `json:"commit"`
	File       string `json:"file"`
	Email      string `json:"email"`
	Repository string `json:"repository"`
	Timestamp  string `json:"timestamp"`
	Line       int    `json:"line"`
}

type trufflehogGithubMeta struct {
	Commit     string `json:"commit"`
	File       string `json:"file"`
	Email      string `json:"email"`
	Repository string `json:"repository"`
	Link       string `json:"link"`
	Timestamp  string `json:"timestamp"`
	Line       int    `json:"line"`
	Visibility string `json:"visibility"`
}

type TruffleHogParser struct{}

func (p *TruffleHogParser) CanParse(data []byte) bool {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return false
	}

	if trimmed[0] == '[' {
		var report []trufflehogFinding
		if err := json.Unmarshal(trimmed, &report); err != nil || len(report) == 0 {
			return false
		}
		return isTrufflehogFinding(report[0])
	}

	dec := json.NewDecoder(bytes.NewReader(trimmed))
	var first trufflehogFinding
	if err := dec.Decode(&first); err != nil {
		return false
	}
	return isTrufflehogFinding(first)
}

func (p *TruffleHogParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	_ = ctx

	report, err := parseTruffleHogFindings(data)
	if err != nil {
		return nil, err
	}

	findings := make([]domain.Finding, 0, len(report))
	for _, item := range report {
		detectorName := strings.TrimSpace(item.DetectorName)
		if detectorName == "" {
			detectorName = "TruffleHog secret"
		}

		filePath, line, commit, url := extractTruffleHogLocation(item.SourceMetadata.Data)
		description := buildTruffleHogDescription(item)

		ruleID := strings.TrimSpace(item.DetectorName)
		if version := strings.TrimSpace(firstNonEmpty(item.ExtraData["version"], item.ExtraData["Version"])); version != "" {
			if ruleID == "" {
				ruleID = detectorName
			}
			ruleID = ruleID + "@" + version
		}
		if ruleID == "" {
			ruleID = detectorName
		}

		secretKind := emptyToNil(item.DetectorName)
		if secretKind == nil {
			secretKind = emptyToNil(detectorName)
		}

		severity := domain.SeverityHigh
		confidence := 2
		if item.Verified {
			severity = domain.SeverityCritical
			confidence = 3
		}

		f := domain.Finding{
			Kind:        domain.KindSecrets,
			Title:       detectorName,
			Description: description,
			Severity:    severity,
			Confidence:  confidence,
			Status:      domain.StatusOpen,
			FilePath:    strings.TrimSpace(filePath),
			LineStart:   line,
			LineEnd:     line,
			SecretKind:  secretKind,
			CommitSHA:   emptyToNil(commit),
			RuleID:      emptyToNil(ruleID),
			RuleName:    emptyToNil(item.DetectorName),
			URL:         emptyToNil(url),
			SourceType:  "trufflehog",
			CVEIDs:      []string{},
			CWEIDs:      []int{},
		}
		secretValue := firstNonEmpty(strings.TrimSpace(item.RawV2), strings.TrimSpace(item.Raw), strings.TrimSpace(item.Redacted))
		if f.SecretKind != nil && secretValue != "" {
			fp := domain.ComputeSecretFingerprint(*f.SecretKind, secretValue)
			f.SecretFingerprint = &fp
		}
		f.Fingerprint = domain.CalculateFingerprint(&f)
		findings = append(findings, f)
	}

	return findings, nil
}

func parseTruffleHogFindings(data []byte) ([]trufflehogFinding, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, fmt.Errorf("parser.TruffleHogParser.Parse: empty input")
	}

	if trimmed[0] == '[' {
		var report []trufflehogFinding
		if err := json.Unmarshal(trimmed, &report); err != nil {
			return nil, fmt.Errorf("parser.TruffleHogParser.Parse: unmarshal array: %w", err)
		}
		return report, nil
	}

	report := make([]trufflehogFinding, 0)
	dec := json.NewDecoder(bytes.NewReader(trimmed))
	for dec.More() {
		var item trufflehogFinding
		if err := dec.Decode(&item); err != nil {
			if err == io.EOF {
				break
			}
			return nil, fmt.Errorf("parser.TruffleHogParser.Parse: decode ndjson: %w", err)
		}
		report = append(report, item)
	}

	if len(report) == 0 {
		return nil, nil
	}
	return report, nil
}

func isTrufflehogFinding(item trufflehogFinding) bool {
	if len(item.SourceMetadata.Data) == 0 || strings.TrimSpace(item.DetectorName) == "" {
		return false
	}
	sourceName := strings.ToLower(strings.TrimSpace(item.SourceName))
	return strings.Contains(sourceName, "trufflehog") || strings.TrimSpace(item.DecoderName) != ""
}

func buildTruffleHogDescription(item trufflehogFinding) string {
	parts := make([]string, 0, 6)
	if v := strings.TrimSpace(item.DetectorDescription); v != "" {
		parts = append(parts, v)
	}
	if v := strings.TrimSpace(item.SourceName); v != "" {
		parts = append(parts, "Источник: "+v)
	}
	if v := strings.TrimSpace(item.ExtraData["rotation_guide"]); v != "" {
		parts = append(parts, "Ротация: "+v)
	}
	if rawPreview := firstNonEmpty(strings.TrimSpace(item.Redacted), strings.TrimSpace(item.Raw), strings.TrimSpace(item.RawV2)); rawPreview != "" {
		parts = append(parts, "Секрет: "+maskSecret(rawPreview))
	}
	parts = append(parts, "Verified: "+strconv.FormatBool(item.Verified))
	return strings.Join(parts, "\n\n")
}

func extractTruffleHogLocation(data map[string]json.RawMessage) (file string, line int, commit string, url string) {
	if len(data) == 0 {
		return "", 0, "", ""
	}

	if raw, ok := data["Filesystem"]; ok {
		var meta trufflehogFilesystemMeta
		if json.Unmarshal(raw, &meta) == nil {
			return strings.TrimSpace(meta.File), meta.Line, "", ""
		}
	}

	if raw, ok := data["Git"]; ok {
		var meta trufflehogGitMeta
		if json.Unmarshal(raw, &meta) == nil {
			return strings.TrimSpace(meta.File), meta.Line, strings.TrimSpace(meta.Commit), buildTrufflehogRepositoryURL(meta.Repository, "", meta.Line)
		}
	}

	if raw, ok := data["Github"]; ok {
		var meta trufflehogGithubMeta
		if json.Unmarshal(raw, &meta) == nil {
			return strings.TrimSpace(meta.File), meta.Line, strings.TrimSpace(meta.Commit), buildTrufflehogRepositoryURL(meta.Repository, meta.Link, meta.Line)
		}
	}

	for _, key := range []string{"Gitlab", "S3", "Docker", "Circle", "Postman"} {
		raw, ok := data[key]
		if !ok {
			continue
		}
		var generic map[string]json.RawMessage
		if err := json.Unmarshal(raw, &generic); err != nil {
			continue
		}

		file = firstNonEmpty(
			extractRawString(generic, "file"),
			extractRawString(generic, "path"),
			extractRawString(generic, "key"),
		)
		line = extractRawInt(generic, "line")
		commit = extractRawString(generic, "commit")
		repository := extractRawString(generic, "repository")
		url = buildTrufflehogRepositoryURL(repository, extractRawString(generic, "link"), line)
		if file != "" || line != 0 || commit != "" || url != "" {
			return file, line, commit, url
		}
	}

	return "", 0, "", ""
}

func extractRawString(data map[string]json.RawMessage, key string) string {
	raw, ok := data[key]
	if !ok {
		return ""
	}
	var value string
	if err := json.Unmarshal(raw, &value); err == nil {
		return strings.TrimSpace(value)
	}
	return ""
}

func extractRawInt(data map[string]json.RawMessage, key string) int {
	raw, ok := data[key]
	if !ok {
		return 0
	}
	var value int
	if err := json.Unmarshal(raw, &value); err == nil {
		return value
	}
	return 0
}

func buildTrufflehogRepositoryURL(repository, link string, line int) string {
	if v := strings.TrimSpace(link); v != "" {
		return v
	}
	repo := strings.TrimSpace(repository)
	if repo == "" {
		return ""
	}
	if line > 0 {
		return repo + "#L" + strconv.Itoa(line)
	}
	return repo
}
