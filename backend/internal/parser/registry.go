package parser

import (
	"encoding/json"
	"fmt"
	"strings"
)

var ErrUnsupportedFormat = fmt.Errorf("unsupported report format")

type Registry struct {
	parsers map[string][]Parser
}

func NewRegistry() *Registry {
	return &Registry{parsers: make(map[string][]Parser)}
}

func (r *Registry) Register(parser Parser) {
	if parser == nil {
		return
	}
	key := strings.ToLower(strings.TrimSpace(parser.ScannerType()))
	if key == "" {
		return
	}
	r.parsers[key] = append(r.parsers[key], parser)
}

func (r *Registry) Find(scannerType string, data []byte) (Parser, error) {
	key := strings.ToLower(strings.TrimSpace(scannerType))
	if key == "" {
		return nil, fmt.Errorf("scanner_type is required")
	}
	parsers := r.parsers[key]
	if len(parsers) == 0 {
		return nil, fmt.Errorf("unknown scanner_type: %s", scannerType)
	}

	for _, entry := range parsers {
		if entry.CanParse(data) {
			return entry, nil
		}
	}
	return nil, ErrUnsupportedFormat
}

var defaultRegistry = func() *Registry {
	registry := NewRegistry()

	// Existing parsers
	registry.Register(&TrivyParser{})
	registry.Register(&ZapParser{})
	registry.Register(&SemgrepParser{})
	registry.Register(&SarifParser{})

	// SAST parsers
	registry.Register(&BanditParser{})
	registry.Register(&CodeQLParser{})
	registry.Register(&GosecParser{})

	// SCA parsers
	registry.Register(&SnykParser{})
	registry.Register(&NpmAuditParser{})
	registry.Register(&PipAuditParser{})

	// DAST parsers
	registry.Register(&NucleiParser{})

	// Secrets parsers
	registry.Register(&GitleaksParser{})
	registry.Register(&TruffleHogParser{})
	registry.Register(&DetectSecretsParser{})

	// Container parsers
	registry.Register(&GrypeParser{})

	// IaC parsers
	registry.Register(&CheckovParser{})
	registry.Register(&KICSParser{})
	registry.Register(&TfsecParser{})
	registry.Register(&TerrascanParser{})

	// Text fallback parsers
	registry.Register(&TextParser{scannerType: "trivy"})
	registry.Register(&TextParser{scannerType: "zap"})
	registry.Register(&TextParser{scannerType: "semgrep"})
	registry.Register(&TextParser{scannerType: "bandit"})
	registry.Register(&TextParser{scannerType: "codeql"})
	registry.Register(&TextParser{scannerType: "gosec"})
	registry.Register(&TextParser{scannerType: "snyk"})
	registry.Register(&TextParser{scannerType: "npm-audit"})
	registry.Register(&TextParser{scannerType: "pip-audit"})
	registry.Register(&TextParser{scannerType: "nuclei"})
	registry.Register(&TextParser{scannerType: "gitleaks"})
	registry.Register(&TextParser{scannerType: "trufflehog"})
	registry.Register(&TextParser{scannerType: "detect-secrets"})
	registry.Register(&TextParser{scannerType: "grype"})
	registry.Register(&TextParser{scannerType: "checkov"})
	registry.Register(&TextParser{scannerType: "kics"})
	registry.Register(&TextParser{scannerType: "tfsec"})
	registry.Register(&TextParser{scannerType: "terrascan"})

	return registry
}()

func ParseReport(scannerType string, data []byte) ([]Finding, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("report is required")
	}

	parser, err := defaultRegistry.Find(scannerType, data)
	if err != nil {
		return nil, err
	}

	findings, err := parser.Parse(data)
	if err != nil {
		return nil, err
	}

	for i := range findings {
		findings[i].Title = strings.TrimSpace(findings[i].Title)
		findings[i].Severity = normalizeSeverity(findings[i].Severity)
		findings[i].Location = strings.TrimSpace(findings[i].Location)
		findings[i].RuleID = strings.TrimSpace(findings[i].RuleID)
		if findings[i].Title == "" {
			return nil, fmt.Errorf("finding title is required")
		}
		if findings[i].Severity == "" {
			findings[i].Severity = "low"
		}
		if !isValidSeverity(findings[i].Severity) {
			return nil, fmt.Errorf("invalid severity: %s", findings[i].Severity)
		}
		if findings[i].RawData == nil {
			findings[i].RawData = map[string]any{}
		}
	}

	if len(findings) == 0 && json.Valid(data) {
		if !strings.EqualFold(scannerType, "semgrep") {
			return nil, fmt.Errorf("report contains no findings")
		}
	}

	return findings, nil
}

func normalizeSeverity(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func isValidSeverity(value string) bool {
	switch value {
	case "low", "medium", "high", "critical":
		return true
	default:
		return false
	}
}
