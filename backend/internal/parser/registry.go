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

func normalizeScannerType(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	v = strings.ReplaceAll(v, "_", "-")

	switch v {
	case "trufflehog3":
		return "trufflehog"
	case "codeql-sarif":
		return "codeql"
	case "npm-audit-json":
		return "npm-audit"
	case "pip-audit-json":
		return "pip-audit"
	default:
		return v
	}
}

func (r *Registry) Register(parser Parser) {
	if parser == nil {
		return
	}

	key := normalizeScannerType(parser.ScannerType())
	if key == "" {
		return
	}

	r.parsers[key] = append(r.parsers[key], parser)
}

func (r *Registry) Find(scannerType string, data []byte) (Parser, error) {
	key := normalizeScannerType(scannerType)
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

	// SAST
	registry.Register(&BanditParser{})
	registry.Register(&CodeQLParser{})
	registry.Register(&GosecParser{})

	// SCA
	registry.Register(&SnykParser{})
	registry.Register(&NpmAuditParser{})
	registry.Register(&PipAuditParser{})

	// DAST
	registry.Register(&NucleiParser{})

	// Secrets
	registry.Register(&GitleaksParser{})
	registry.Register(&TruffleHogParser{})
	registry.Register(&DetectSecretsParser{})

	// Container
	registry.Register(&GrypeParser{})

	// IaC
	registry.Register(&CheckovParser{})
	registry.Register(&KICSParser{})
	registry.Register(&TfsecParser{})
	registry.Register(&TerrascanParser{})

	// Generic / SARIF / JSON
	registry.Register(&SarifParser{})
	registry.Register(&SemgrepParser{})
	registry.Register(&TrivyParser{})
	registry.Register(&ZapParser{})

	// Text fallback
	for _, t := range []string{
		"trivy", "zap", "semgrep",
		"bandit", "codeql", "gosec",
		"snyk", "npm-audit", "pip-audit",
		"nuclei", "gitleaks", "trufflehog",
		"detect-secrets", "grype",
		"checkov", "kics", "tfsec", "terrascan",
	} {
		registry.Register(&TextParser{scannerType: t})
	}

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

	if len(findings) == 0 && json.Valid(data) && !strings.EqualFold(scannerType, "semgrep") {
		return nil, fmt.Errorf("report contains no findings")
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
