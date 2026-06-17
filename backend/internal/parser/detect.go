package parser

import (
	"context"
	"errors"

	"redlycoris/internal/domain"
)

var parsers = []struct {
	name   string
	parser Parser
}{
	{"sarif", &SARIFParser{}},
	{"trivy", &TrivyParser{}},
	{"semgrep", &SemgrepParser{}},
	{"gosec", &GosecParser{}},
	{"trufflehog", &TruffleHogParser{}},
	{"gitleaks", &GitleaksParser{}},
	{"checkov", &CheckovParser{}},
	{"zap", &ZAPParser{}},
	{"grype", &GrypeParser{}},
	{"generic", &GenericParser{}},
}

type Detector struct {
	scannerKindOverrides map[string]domain.FindingKind
}

func NewDetector(scannerKindOverrides map[string]domain.FindingKind) *Detector {
	copied := make(map[string]domain.FindingKind, len(scannerKindOverrides))
	for scanner, kind := range scannerKindOverrides {
		copied[domain.NormalizeScannerName(scanner)] = kind
	}
	return &Detector{scannerKindOverrides: copied}
}

func DetectAndParse(ctx context.Context, data []byte) (string, []domain.Finding, error) {
	return NewDetector(nil).DetectAndParse(ctx, data)
}

func (d *Detector) DetectAndParse(ctx context.Context, data []byte) (string, []domain.Finding, error) {
	for _, p := range parsers {
		if p.parser.CanParse(data) {
			findings, err := p.parser.Parse(ctx, data)
			if err != nil {
				return p.name, nil, err
			}
			d.resolveFallbackKinds(findings)
			return p.name, findings, nil
		}
	}
	return "", nil, errors.New("unsupported format: no parser matched the input")
}

func (d *Detector) resolveFallbackKinds(findings []domain.Finding) {
	var overrides map[string]domain.FindingKind
	if d != nil {
		overrides = d.scannerKindOverrides
	}

	for i := range findings {
		if findings[i].Kind != domain.KindOther {
			continue
		}
		resolved := domain.ResolveKind(&findings[i], overrides)
		if resolved == findings[i].Kind {
			continue
		}
		findings[i].Kind = resolved
		findings[i].Fingerprint = domain.CalculateFingerprint(&findings[i])
	}
}
