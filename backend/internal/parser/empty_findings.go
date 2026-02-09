package parser

func AllowEmptyFindings(scannerType string) bool {
	switch normalizeScannerType(scannerType) {
	case "semgrep", "trivy", "grype", "checkov", "kics", "gitleaks", "opengrep":
		return true
	default:
		return false
	}
}
