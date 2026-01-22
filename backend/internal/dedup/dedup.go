package dedup

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"lotus-warden/backend/internal/parser"
)

func ComputeFingerprint(scannerType string, finding parser.Finding) string {
	if strings.EqualFold(finding.Category, "SCA") {
		vulnID := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractEvidenceString(finding.Evidence, "vulnerabilityId"),
			extractEvidenceString(finding.Evidence, "vulnerability_id"),
			finding.RuleID,
		)))
		pkgName := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractEvidenceString(finding.Evidence, "pkgName"),
			extractEvidenceString(finding.Evidence, "package"),
			extractEvidenceString(finding.RawData, "package"),
		)))
		installedVersion := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractEvidenceString(finding.Evidence, "installedVersion"),
			extractEvidenceString(finding.Evidence, "installed_version"),
			extractEvidenceString(finding.RawData, "installed_version"),
		)))
		target := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractEvidenceString(finding.Evidence, "target"),
			extractEvidenceString(finding.RawData, "target"),
		)))
		ecosystem := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractEvidenceString(finding.Evidence, "ecosystem"),
			extractEvidenceString(finding.RawData, "target_type"),
		)))
		class := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractEvidenceString(finding.Evidence, "class"),
			extractEvidenceString(finding.RawData, "class"),
		)))
		scanner := strings.ToLower(strings.TrimSpace(scannerType))
		seed := strings.Join([]string{vulnID, pkgName, installedVersion, target, ecosystem, class, scanner}, "|")
		hash := sha256.Sum256([]byte(seed))
		return hex.EncodeToString(hash[:])
	}

	normalized := strings.ToLower(strings.TrimSpace(finding.Title))
	location := strings.TrimSpace(finding.Location)
	ruleID := strings.ToLower(strings.TrimSpace(finding.RuleID))
	scanner := strings.ToLower(strings.TrimSpace(scannerType))
	seed := strings.Join([]string{normalized, scanner, location, ruleID}, "|")
	hash := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(hash[:])
}

func extractEvidenceString(data map[string]any, key string) string {
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
