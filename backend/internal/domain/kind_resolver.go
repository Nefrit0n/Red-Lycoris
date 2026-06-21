package domain

import (
	"encoding/json"
	"sort"
	"strings"
)

// ResolveKind determines a finding kind from stable finding content first and
// scanner names only as a weak fallback. Callers that need to preserve an
// authoritative parser/user kind should only invoke it for KindOther findings.
func ResolveKind(f *Finding, overrides map[string]FindingKind) FindingKind {
	if f == nil {
		return KindOther
	}

	switch {
	case hasTextPtr(f.SecretKind) || hasTextPtr(f.SecretFingerprint) || hasTextPtr(f.CommitSHA):
		return KindSecrets
	case hasTextPtr(f.IacResource) || hasTextPtr(f.IacProvider):
		return KindIaC
	case hasTextPtr(f.URL) || hasTextPtr(f.HTTPMethod) || hasTextPtr(f.HTTPParam) || hasJSONValue(f.HTTPEvidence):
		return KindDAST
	case hasTextPtr(f.Purl) ||
		hasTextPtr(f.PackageEcosystem) ||
		hasTextPtr(f.FixedVersion) ||
		(strings.TrimSpace(f.Component) != "" && strings.TrimSpace(f.ComponentVersion) != "") ||
		(len(f.CVEIDs) > 0 && strings.TrimSpace(f.Component) != ""):
		return KindSCA
	case strings.TrimSpace(f.FilePath) != "" && (f.LineStart > 0 || hasTextPtr(f.RuleID)):
		return KindSAST
	}

	if kind, ok := resolveScannerKindHint(f.SourceType, overrides); ok {
		return kind
	}
	return KindOther
}

func hasTextPtr(v *string) bool {
	return v != nil && strings.TrimSpace(*v) != ""
}

func hasJSONValue(raw json.RawMessage) bool {
	v := strings.TrimSpace(string(raw))
	return v != "" && v != "null"
}

func resolveScannerKindHint(sourceType string, overrides map[string]FindingKind) (FindingKind, bool) {
	name := NormalizeScannerName(sourceType)
	if name == "" {
		return KindOther, false
	}

	if kind, ok := matchScannerKind(name, overrides); ok {
		return kind, true
	}
	if kind, ok := scannerKindHints[name]; ok {
		return kind, true
	}
	if IsMultiCategoryScanner(name) {
		return KindOther, false
	}
	if kind, ok := matchScannerKind(name, scannerKindHints); ok {
		return kind, true
	}
	return KindOther, false
}

func matchScannerKind(sourceType string, hints map[string]FindingKind) (FindingKind, bool) {
	if len(hints) == 0 {
		return KindOther, false
	}
	if kind, ok := hints[sourceType]; ok {
		return kind, true
	}

	keys := make([]string, 0, len(hints))
	for key := range hints {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if len(keys[i]) == len(keys[j]) {
			return keys[i] < keys[j]
		}
		return len(keys[i]) > len(keys[j])
	})

	for _, key := range keys {
		if key != "" && strings.Contains(sourceType, key) {
			return hints[key], true
		}
	}
	return KindOther, false
}

// NormalizeScannerName returns the canonical key format used by
// RL_SCANNER_KIND_OVERRIDES and the built-in weak scanner hints.
func NormalizeScannerName(name string) string {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.ReplaceAll(normalized, "_", "-")
	normalized = strings.Join(strings.Fields(normalized), " ")
	return normalized
}

// IsMultiCategoryScanner reports scanners where a single name is not a safe
// kind hint because the tool can emit SCA/SAST/DAST/IaC/secrets findings.
func IsMultiCategoryScanner(sourceType string) bool {
	name := NormalizeScannerName(sourceType)
	for _, scanner := range multiCategoryScanners {
		if scanner == name || strings.Contains(name, scanner) {
			return true
		}
	}
	return false
}

var scannerKindHints = map[string]FindingKind{
	// SCA / dependency vulnerability scanners.
	"anchore":          KindSCA,
	"bundler-audit":    KindSCA,
	"cargo-audit":      KindSCA,
	"composer-audit":   KindSCA,
	"dependency-check": KindSCA,
	"depscan":          KindSCA,
	"fossa":            KindSCA,
	"gemnasium":        KindSCA,
	"govulncheck":      KindSCA,
	"grype":            KindSCA,
	"maven-audit":      KindSCA,
	"mend":             KindSCA,
	"nancy":            KindSCA,
	"nexus-iq":         KindSCA,
	"npm-audit":        KindSCA,
	"oss-index":        KindSCA,
	"osv-scanner":      KindSCA,
	"owasp dependency": KindSCA,
	"owasp-dependency": KindSCA,
	"pip-audit":        KindSCA,
	"pnpm-audit":       KindSCA,
	"renovate":         KindSCA,
	"retire.js":        KindSCA,
	"safety":           KindSCA,
	"scout":            KindSCA,
	"sonatype":         KindSCA,
	"snyk-open-source": KindSCA,
	"whitesource":      KindSCA,
	"yarn-audit":       KindSCA,
	"blackduck":        KindSCA,
	"black-duck":       KindSCA,
	"bolt":             KindSCA,
	"osv":              KindSCA,

	// SAST / static code analyzers.
	"bandit":          KindSAST,
	"brakeman":        KindSAST,
	"codeql":          KindSAST,
	"coverity":        KindSAST,
	"cppcheck":        KindSAST,
	"eslint-security": KindSAST,
	"findsecbugs":     KindSAST,
	"flawfinder":      KindSAST,
	"gosec":           KindSAST,
	"horusec":         KindSAST,
	"insider":         KindSAST,
	"jshint":          KindSAST,
	"mobsfscan":       KindSAST,
	"njsscan":         KindSAST,
	"pmd":             KindSAST,
	"progpilot":       KindSAST,
	"psalm":           KindSAST,
	"pylint":          KindSAST,
	"roslyn":          KindSAST,
	"rubocop":         KindSAST,
	"security-code":   KindSAST,
	"semgrep-sast":    KindSAST,
	"sobelow":         KindSAST,
	"spotbugs":        KindSAST,
	"staticcheck":     KindSAST,
	"tslint":          KindSAST,

	// DAST / dynamic web application scanners.
	"acunetix":     KindDAST,
	"arachni":      KindDAST,
	"appscan":      KindDAST,
	"burp":         KindDAST,
	"detectify":    KindDAST,
	"invicti":      KindDAST,
	"netsparker":   KindDAST,
	"nikto":        KindDAST,
	"nuclei":       KindDAST,
	"skipfish":     KindDAST,
	"snallygaster": KindDAST,
	"stackhawk":    KindDAST,
	"w3af":         KindDAST,
	"wapiti":       KindDAST,
	"webinspect":   KindDAST,
	"whatweb":      KindDAST,
	"zaproxy":      KindDAST,
	"zap":          KindDAST,
	"owasp zap":    KindDAST,
	"owasp-zap":    KindDAST,

	// IaC / configuration scanners.
	"cfn-lint":             KindIaC,
	"cfn-nag":              KindIaC,
	"checkov":              KindIaC,
	"cloudsplaining":       KindIaC,
	"conftest":             KindIaC,
	"datree":               KindIaC,
	"hadolint":             KindIaC,
	"kics":                 KindIaC,
	"kube-bench":           KindIaC,
	"kube-hunter":          KindIaC,
	"kube-score":           KindIaC,
	"kubesec":              KindIaC,
	"polaris":              KindIaC,
	"regula":               KindIaC,
	"terrascan":            KindIaC,
	"tfsec":                KindIaC,
	"trivy-config":         KindIaC,
	"tflint":               KindIaC,
	"terraform-compliance": KindIaC,

	// Secrets scanners.
	"detect-secrets":      KindSecrets,
	"gitleaks":            KindSecrets,
	"git-secrets":         KindSecrets,
	"gitguardian":         KindSecrets,
	"ggshield":            KindSecrets,
	"nosey-parker":        KindSecrets,
	"secretlint":          KindSecrets,
	"shhgit":              KindSecrets,
	"trufflehog":          KindSecrets,
	"whispers":            KindSecrets,
	"yelp-detect-secrets": KindSecrets,
}

var multiCategoryScanners = []string{
	"aqua",
	"checkmarx",
	"codeql-with-deps",
	"fortify",
	"github-advanced-security",
	"github code scanning",
	"github-code-scanning",
	"gitlab-secure",
	"gitlab-security",
	"semgrep",
	"sonarqube",
	"snyk",
	"synopsys",
	"trivy",
	"veracode",
}
