package dedup

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"

	"lotus-warden/backend/internal/parser"
)

// ComputeFingerprint returns a stable fingerprint used for deduplication.
//
// Important:
// - For SCA we use (vulnID + pkg + version + target + ecosystem + class + scanner).
// - For SAST we MUST NOT rely on Title (UI-only) because Title is allowed to change.
//   For SAST we use (scanner + category + ruleID + path + start/end range).
// - For other categories we keep legacy behavior for now to avoid changing semantics abruptly.
func ComputeFingerprint(scannerType string, finding parser.Finding) string {
	category := strings.ToLower(strings.TrimSpace(finding.Category))
	scanner := strings.ToLower(strings.TrimSpace(scannerType))
	ruleID := strings.ToLower(strings.TrimSpace(finding.RuleID))

	// --- SCA (keep as-is, already "Trivy-like") ---
	if strings.EqualFold(finding.Category, "SCA") {
		vulnID := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractString(finding.Evidence, "vulnerabilityId"),
			extractString(finding.Evidence, "vulnerability_id"),
			finding.RuleID,
		)))
		pkgName := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractString(finding.Evidence, "pkgName"),
			extractString(finding.Evidence, "package"),
			extractString(finding.RawData, "package"),
		)))
		installedVersion := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractString(finding.Evidence, "installedVersion"),
			extractString(finding.Evidence, "installed_version"),
			extractString(finding.RawData, "installed_version"),
		)))
		target := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractString(finding.Evidence, "target"),
			extractString(finding.RawData, "target"),
		)))
		ecosystem := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractString(finding.Evidence, "ecosystem"),
			extractString(finding.RawData, "target_type"),
		)))
		class := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractString(finding.Evidence, "class"),
			extractString(finding.RawData, "class"),
		)))

		seed := strings.Join([]string{vulnID, pkgName, installedVersion, target, ecosystem, class, scanner}, "|")
		return sha256Hex(seed)
	}

	// --- SAST (Semgrep + other SAST scanners) ---
	// Goal: Title changes MUST NOT affect fingerprint.
	if category == "sast" || scanner == "semgrep" {
		path := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			extractString(finding.Evidence, "path"),
			extractString(finding.RawData, "path"),
		)))

		// Try to read start/end from evidence (Semgrep provides them)
		startLine := extractIntNested(finding.Evidence, "start", "line")
		startCol := extractIntNested(finding.Evidence, "start", "col")
		endLine := extractIntNested(finding.Evidence, "end", "line")
		endCol := extractIntNested(finding.Evidence, "end", "col")

		location := strings.ToLower(strings.TrimSpace(finding.Location))

		// If we have no path, fallback to parsing location
		if path == "" && location != "" {
			p, l, c := parseLocation(location)
			if path == "" {
				path = p
			}
			if startLine == 0 {
				startLine = l
			}
			if startCol == 0 {
				startCol = c
			}
		}

		// Build stable seed
		seedParts := []string{
			scanner,
			category,
			ruleID,
			path,
			intToStr(startLine),
			intToStr(startCol),
			intToStr(endLine),
			intToStr(endCol),
		}

		// If range is totally absent, include location as a last resort (still no Title)
		if startLine == 0 && endLine == 0 && location != "" {
			seedParts = append(seedParts, location)
		}

		seed := strings.Join(seedParts, "|")
		return sha256Hex(seed)
	}

	// --- Legacy (other categories) ---
	// NOTE: This keeps current behavior unchanged for Secrets/Config/DAST/etc until
	// we define proper category-specific stable identifiers.
	normalizedTitle := strings.ToLower(strings.TrimSpace(finding.Title))
	location := strings.TrimSpace(finding.Location)
	seed := strings.Join([]string{normalizedTitle, scanner, location, ruleID}, "|")
	return sha256Hex(seed)
}

func sha256Hex(seed string) string {
	hash := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(hash[:])
}

func extractString(data map[string]any, key string) string {
	if data == nil {
		return ""
	}
	v, ok := data[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case json.RawMessage:
		// sometimes stored as raw json; try decode string
		var s string
		if err := json.Unmarshal(t, &s); err == nil {
			return s
		}
		return ""
	default:
		return ""
	}
}

// extractIntNested extracts int from nested object like evidence["start"]["line"].
// Handles float64 (encoding/json default), int, json.Number, string.
func extractIntNested(data map[string]any, objKey, fieldKey string) int {
	if data == nil {
		return 0
	}
	obj, ok := data[objKey]
	if !ok || obj == nil {
		return 0
	}

	m, ok := obj.(map[string]any)
	if !ok || m == nil {
		return 0
	}

	val, ok := m[fieldKey]
	if !ok || val == nil {
		return 0
	}

	switch t := val.(type) {
	case int:
		return t
	case int32:
		return int(t)
	case int64:
		return int(t)
	case float64:
		return int(t)
	case json.Number:
		i, _ := t.Int64()
		return int(i)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(t))
		return i
	default:
		return 0
	}
}

func intToStr(i int) string {
	if i <= 0 {
		return ""
	}
	return strconv.Itoa(i)
}

// parseLocation tries to parse "path:line[:col]" from location (lowercased already preferred).
// Returns path, line, col (line/col = 0 if not parsed).
func parseLocation(loc string) (string, int, int) {
	loc = strings.TrimSpace(loc)
	if loc == "" {
		return "", 0, 0
	}

	// split from the right: path may contain ":" (windows). We'll do a conservative parse:
	// try last token as line or col.
	parts := strings.Split(loc, ":")
	if len(parts) < 2 {
		return loc, 0, 0
	}

	// Try parse last as col, previous as line
	last := strings.TrimSpace(parts[len(parts)-1])
	prev := strings.TrimSpace(parts[len(parts)-2])

	col, errCol := strconv.Atoi(last)
	line, errLine := strconv.Atoi(prev)

	if errLine == nil && errCol == nil && len(parts) >= 3 {
		path := strings.Join(parts[:len(parts)-2], ":")
		return strings.TrimSpace(path), line, col
	}

	// Try parse last as line only
	line, errLine = strconv.Atoi(last)
	if errLine == nil {
		path := strings.Join(parts[:len(parts)-1], ":")
		return strings.TrimSpace(path), line, 0
	}

	// Fallback: cannot parse numeric suffixes
	return loc, 0, 0
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
