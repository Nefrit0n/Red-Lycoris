package bdu

import (
	"regexp"
	"strconv"
	"strings"
)

// VersionConstraint represents a single parsed version condition from BDU software_version text.
type VersionConstraint struct {
	ExactVersion string // non-empty for exact match, e.g. "2.0.5"
	MinVersion   string // lower bound inclusive, empty if unbounded
	MaxVersion   string // upper bound inclusive, empty if unbounded
}

var (
	versionToken = `[0-9][0-9A-Za-z._:-]*`
	// "от 1.1 до 2.2.13 включительно (Dovecot)" / "от 1.1 до 2.2.13"
	reFromTo = regexp.MustCompile(`от\s+(` + versionToken + `)\s+до\s+(` + versionToken + `)(?:\s+включительно)?`)
	// "до 7.7.5 включительно (QuickTime)" / "до 7.7.5"
	reUpTo = regexp.MustCompile(`до\s+(` + versionToken + `)(?:\s+включительно)?`)
	// "9.0.0 - 9.0.16 (PostgreSQL)"  but NOT "CVE-2024-1234"
	reDashRange = regexp.MustCompile(`(` + versionToken + `)\s+-\s+(` + versionToken + `)`)
	// bare version like "2.0.5" or "11.1.0.7 (Database)"
	reExact = regexp.MustCompile(`(` + versionToken + `)`)
	// Decimal comma in Russian notation: "7,3" => "7.3"
	reDecimalComma = regexp.MustCompile(`([0-9]),([0-9])`)
)

// ParseVersionConstraints parses a BDU software_version string into a list of constraints.
// The input may contain comma-separated entries, each with optional parenthesized software names.
func ParseVersionConstraints(softwareVersion string) []VersionConstraint {
	normalized := normalizeVersionText(softwareVersion)
	fragments := splitFragments(normalized)
	var constraints []VersionConstraint
	for _, frag := range fragments {
		frag = strings.TrimSpace(frag)
		if frag == "" {
			continue
		}
		if c, ok := parseFragment(frag); ok {
			constraints = append(constraints, c)
		}
	}
	return constraints
}

func normalizeVersionText(s string) string {
	// Keep list separators intact (", ") and normalize only decimal commas between digits.
	return reDecimalComma.ReplaceAllString(s, `$1.$2`)
}

// splitFragments splits the software_version string by commas, but respects
// that each entry may contain parenthesized software names like "11.1.0.7 (Database)".
// We split on ", " followed by a digit or "от"/"до" to avoid splitting inside parentheses.
func splitFragments(s string) []string {
	var fragments []string
	var current strings.Builder
	runes := []rune(s)
	for i := 0; i < len(runes); i++ {
		if runes[i] == ',' {
			// Look ahead: skip whitespace and check if next token starts a new version entry.
			j := i + 1
			hasSpace := false
			for j < len(runes) && runes[j] == ' ' {
				hasSpace = true
				j++
			}
			// Split only on ", " boundaries; plain "," can be decimal notation (e.g. "7,3").
			if hasSpace && j < len(runes) && isFragmentStart(runes, j) {
				fragments = append(fragments, current.String())
				current.Reset()
				i = j - 1 // will be incremented by loop
				continue
			}
		}
		current.WriteRune(runes[i])
	}
	if current.Len() > 0 {
		fragments = append(fragments, current.String())
	}
	return fragments
}

func isFragmentStart(runes []rune, pos int) bool {
	if pos >= len(runes) {
		return false
	}
	r := runes[pos]
	if r >= '0' && r <= '9' {
		return true
	}
	// Check for "от " or "до "
	remaining := string(runes[pos:])
	if strings.HasPrefix(remaining, "от ") || strings.HasPrefix(remaining, "до ") {
		return true
	}
	return false
}

func parseFragment(frag string) (VersionConstraint, bool) {
	// 1. "от X до Y включительно"
	if m := reFromTo.FindStringSubmatch(frag); m != nil {
		return VersionConstraint{MinVersion: m[1], MaxVersion: m[2]}, true
	}
	// 2. "до X включительно"
	if m := reUpTo.FindStringSubmatch(frag); m != nil {
		return VersionConstraint{MaxVersion: m[1]}, true
	}
	// 3. "X - Y" dash range (but avoid matching CVE-like patterns)
	if m := reDashRange.FindStringSubmatch(frag); m != nil {
		// Ensure this isn't part of a CVE identifier
		idx := reDashRange.FindStringIndex(frag)
		if idx != nil && (idx[0] == 0 || frag[idx[0]-1] != '-') {
			return VersionConstraint{MinVersion: m[1], MaxVersion: m[2]}, true
		}
	}
	// 4. Exact version
	if m := reExact.FindStringSubmatch(frag); m != nil {
		return VersionConstraint{ExactVersion: m[1]}, true
	}
	return VersionConstraint{}, false
}

// CompareVersions compares two version strings segment by segment.
// Returns -1 if a < b, 0 if a == b, 1 if a > b.
// Non-numeric segments are compared lexicographically.
func CompareVersions(a, b string) int {
	partsA := strings.Split(a, ".")
	partsB := strings.Split(b, ".")

	maxLen := len(partsA)
	if len(partsB) > maxLen {
		maxLen = len(partsB)
	}

	for i := 0; i < maxLen; i++ {
		var segA, segB string
		if i < len(partsA) {
			segA = partsA[i]
		}
		if i < len(partsB) {
			segB = partsB[i]
		}

		numA, errA := strconv.Atoi(segA)
		numB, errB := strconv.Atoi(segB)

		if errA == nil && errB == nil {
			if numA < numB {
				return -1
			}
			if numA > numB {
				return 1
			}
		} else {
			// Fallback to string comparison for non-numeric segments
			if segA < segB {
				return -1
			}
			if segA > segB {
				return 1
			}
		}
	}
	return 0
}

// MatchesAny checks if componentVersion falls within at least one of the constraints.
func MatchesAny(componentVersion string, constraints []VersionConstraint) bool {
	if len(constraints) == 0 {
		return false
	}
	cv := strings.TrimSpace(componentVersion)
	if cv == "" {
		return false
	}
	for _, c := range constraints {
		if matchesConstraint(cv, c) {
			return true
		}
	}
	return false
}

func matchesConstraint(cv string, c VersionConstraint) bool {
	if c.ExactVersion != "" {
		return CompareVersions(cv, c.ExactVersion) == 0
	}
	if c.MinVersion != "" && CompareVersions(cv, c.MinVersion) < 0 {
		return false
	}
	if c.MaxVersion != "" && CompareVersions(cv, c.MaxVersion) > 0 {
		return false
	}
	// If both min and max are empty, no match
	if c.MinVersion == "" && c.MaxVersion == "" {
		return false
	}
	return true
}
