package domain

import (
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"
)

func CalculateFingerprint(f *Finding) string {
	var cveID string
	if len(f.CVEIDs) > 0 {
		cveID = f.CVEIDs[0]
	}

	var cweID string
	if len(f.CWEIDs) > 0 {
		cweID = fmt.Sprintf("%d", f.CWEIDs[0])
	} else {
		cweID = "0"
	}

	var ruleID string
	if f.RuleID != nil {
		ruleID = *f.RuleID
	}

	parts := []string{
		strconv.Itoa(int(f.Kind)),
		strings.ToLower(ruleID),
		strings.ToLower(cveID),
		strings.ToLower(f.FilePath),
		cweID,
		strings.ToLower(f.Component),
		strings.ToLower(f.ComponentVersion),
	}

	input := strings.Join(parts, "")
	h := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", h)
}
