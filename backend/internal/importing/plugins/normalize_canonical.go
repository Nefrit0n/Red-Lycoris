package plugins

import (
	"strings"

	"lotus-warden/backend/internal/intel"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/parser"
)

func normalizeTrivyFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		kind := normalizeKind(detectFindingType(finding))
		category := mapTrivyCategory(kind)
		base.Category = category
		base.Kind = kind

		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		component := buildScaComponent(finding)
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, category, kind, component, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

func normalizeSemgrepFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		base.Category = models.CategorySAST
		base.Kind = "sast"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, nil, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

func normalizeZapFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		base.Category = models.CategoryDAST
		base.Kind = "dast"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, nil, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

func mapTrivyCategory(kind string) string {
	switch strings.ToLower(strings.TrimSpace(kind)) {
	case "vulnerability":
		return models.CategorySCA
	case "misconfiguration":
		return models.CategoryConfig
	case "secret":
		return models.CategorySecrets
	case "license":
		return models.CategoryLicense
	default:
		return models.CategoryUnknown
	}
}

func detectFindingType(finding parser.Finding) string {
	kind := strings.TrimSpace(extractString(finding.Evidence, "findingType"))
	if kind == "" {
		kind = strings.TrimSpace(extractString(finding.RawData, "type"))
	}
	if kind == "" {
		kind = strings.TrimSpace(finding.Category)
	}
	if kind == "" {
		return "unknown"
	}
	return kind
}

func normalizeKind(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "unknown"
	}
	return trimmed
}

func buildScaComponent(finding parser.Finding) map[string]any {
	if !strings.EqualFold(finding.Category, models.CategorySCA) && !strings.EqualFold(detectFindingType(finding), "vulnerability") {
		return nil
	}
	packageName := firstNonEmptyString(
		extractString(finding.Evidence, "pkgName"),
		extractString(finding.Evidence, "package"),
		extractString(finding.RawData, "package"),
	)
	installedVersion := firstNonEmptyString(
		extractString(finding.Evidence, "installedVersion"),
		extractString(finding.Evidence, "installed_version"),
		extractString(finding.RawData, "installed_version"),
	)
	if packageName == "" || installedVersion == "" {
		return nil
	}
	component := map[string]any{
		"package_name":      packageName,
		"installed_version": installedVersion,
	}
	if fixedVersion := firstNonEmptyString(
		extractString(finding.Evidence, "fixedVersion"),
		extractString(finding.Evidence, "fixed_version"),
		extractString(finding.RawData, "fixed_version"),
	); fixedVersion != "" {
		component["fixed_version"] = fixedVersion
	}
	if purl := strings.TrimSpace(extractString(finding.Evidence, "purl")); purl != "" {
		component["purl"] = purl
	}
	if ecosystem := strings.TrimSpace(extractString(finding.Evidence, "ecosystem")); ecosystem != "" {
		component["ecosystem"] = ecosystem
	}
	return component
}

func applyCanonical(rawData map[string]any, category, kind string, component map[string]any, identifiers []string) map[string]any {
	if rawData == nil {
		rawData = map[string]any{}
	}
	canonical := map[string]any{
		"category": category,
		"kind":     kind,
	}
	if len(component) > 0 {
		canonical["component"] = component
	}
	if len(identifiers) > 0 {
		canonical["identifiers"] = identifiers
	}
	rawData["canonical"] = canonical
	return rawData
}

func extractString(data map[string]any, key string) string {
	if data == nil {
		return ""
	}
	value, ok := data[key]
	if !ok {
		return ""
	}
	if str, ok := value.(string); ok {
		return str
	}
	return ""
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// Generic SAST normalizer for Bandit, CodeQL, Gosec, etc.
func normalizeSASTFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		base.Category = models.CategorySAST
		base.Kind = "sast"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, nil, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

// Generic SCA normalizer for Snyk, npm-audit, pip-audit, etc.
func normalizeSCAFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		component := buildScaComponent(finding)
		base.Category = models.CategorySCA
		base.Kind = "vulnerability"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, component, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

// Generic DAST normalizer for Nuclei, etc.
func normalizeDASTFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		base.Category = models.CategoryDAST
		base.Kind = "dast"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, nil, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

// Generic Secrets normalizer for Gitleaks, TruffleHog, detect-secrets, etc.
func normalizeSecretsFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		base.Category = models.CategorySecrets
		base.Kind = "secret"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, nil, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

// Generic Container normalizer for Grype, etc.
func normalizeContainerFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		component := buildScaComponent(finding)
		base.Category = models.CategoryContainer
		base.Kind = "vulnerability"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, component, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}

// Generic IaC normalizer for Checkov, KICS, tfsec, Terrascan, etc.
func normalizeIACFindings(findings []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		identifiers := intel.ExtractIdentifiersFromFinding(finding)
		base.Category = models.CategoryIAC
		base.Kind = "iac"
		base.Identifiers = identifiers
		base.RawData = applyCanonical(base.RawData, base.Category, base.Kind, nil, identifiers)
		canonical = append(canonical, base)
	}
	return canonical, nil
}
