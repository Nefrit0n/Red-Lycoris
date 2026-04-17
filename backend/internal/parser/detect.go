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
	{"trufflehog", &TruffleHogParser{}},
	{"gitleaks", &GitleaksParser{}},
	{"checkov", &CheckovParser{}},
	{"generic", &GenericParser{}},
}

func DetectAndParse(ctx context.Context, data []byte) (string, []domain.Finding, error) {
	for _, p := range parsers {
		if p.parser.CanParse(data) {
			findings, err := p.parser.Parse(ctx, data)
			if err != nil {
				return p.name, nil, err
			}
			return p.name, findings, nil
		}
	}
	return "", nil, errors.New("unsupported format: no parser matched the input")
}
