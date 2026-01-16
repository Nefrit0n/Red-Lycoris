package dedup

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"lotus-warden/backend/internal/parser"
)

func ComputeFingerprint(scannerType string, finding parser.Finding) string {
	normalized := strings.ToLower(strings.TrimSpace(finding.Title))
	location := strings.TrimSpace(finding.Location)
	ruleID := strings.ToLower(strings.TrimSpace(finding.RuleID))
	scanner := strings.ToLower(strings.TrimSpace(scannerType))
	seed := strings.Join([]string{normalized, scanner, location, ruleID}, "|")
	hash := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(hash[:])
}
