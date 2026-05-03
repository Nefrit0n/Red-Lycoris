package nvd

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
)

type CPEVerdict struct {
	Verdict       string         `json:"verdict"`
	Matched       []CPEMatchInfo `json:"matched,omitempty"`
	ReasonSummary string         `json:"reason_summary"`
}

type CPEMatchInfo struct {
	Criteria              string `json:"criteria"`
	Vulnerable            bool   `json:"vulnerable"`
	VersionStartIncluding string `json:"version_start_including,omitempty"`
	VersionStartExcluding string `json:"version_start_excluding,omitempty"`
	VersionEndIncluding   string `json:"version_end_including,omitempty"`
	VersionEndExcluding   string `json:"version_end_excluding,omitempty"`
	Reason                string `json:"reason"`
}

type nvdConfiguration struct {
	Operator string    `json:"operator"`
	Nodes    []nvdNode `json:"nodes"`
}

type nvdNode struct {
	Operator string        `json:"operator"`
	CPEMatch []nvdCPEMatch `json:"cpeMatch"`
	Children []nvdNode     `json:"children"`
	Negate   bool          `json:"negate"`
}

type nvdCPEMatch struct {
	Vulnerable            bool   `json:"vulnerable"`
	Criteria              string `json:"criteria"`
	VersionStartIncluding string `json:"versionStartIncluding"`
	VersionStartExcluding string `json:"versionStartExcluding"`
	VersionEndIncluding   string `json:"versionEndIncluding"`
	VersionEndExcluding   string `json:"versionEndExcluding"`
}

func MatchCPE(component, componentVersion string, cpeMatchesRaw json.RawMessage) CPEVerdict {
	if len(cpeMatchesRaw) == 0 || strings.TrimSpace(component) == "" {
		return CPEVerdict{Verdict: "unknown", ReasonSummary: "недостаточно данных для сопоставления"}
	}

	if strings.TrimSpace(componentVersion) == "" {
		return CPEVerdict{Verdict: "unknown", ReasonSummary: "версия компонента неизвестна"}
	}

	matches := flattenCPEMatches(cpeMatchesRaw)
	if len(matches) == 0 {
		return CPEVerdict{Verdict: "unknown", ReasonSummary: "недостаточно данных для сопоставления"}
	}

	normComponent := normalize(component)
	productMatched := false
	inRange := false
	considered := make([]CPEMatchInfo, 0)

	for _, cm := range matches {
		product, ok := extractProduct(cm.Criteria)
		if !ok {
			continue
		}
		if !productsMatch(normComponent, normalize(product)) {
			continue
		}
		productMatched = true

		okInRange, reason, cmpOK := checkVersionRange(componentVersion, cm)
		if !cmpOK {
			return CPEVerdict{Verdict: "unknown", ReasonSummary: "не удалось сравнить версии"}
		}

		info := CPEMatchInfo{
			Criteria:              cm.Criteria,
			Vulnerable:            cm.Vulnerable,
			VersionStartIncluding: cm.VersionStartIncluding,
			VersionStartExcluding: cm.VersionStartExcluding,
			VersionEndIncluding:   cm.VersionEndIncluding,
			VersionEndExcluding:   cm.VersionEndExcluding,
			Reason:                reason,
		}
		considered = append(considered, info)

		if cm.Vulnerable && okInRange {
			inRange = true
		}
	}

	if inRange {
		return CPEVerdict{
			Verdict:       "affected",
			Matched:       considered,
			ReasonSummary: fmt.Sprintf("Версия %s попадает в уязвимый диапазон", componentVersion),
		}
	}

	if productMatched {
		return CPEVerdict{
			Verdict:       "not_affected",
			Matched:       considered,
			ReasonSummary: fmt.Sprintf("Версия %s вне уязвимых диапазонов", componentVersion),
		}
	}

	return CPEVerdict{Verdict: "unknown", ReasonSummary: "компонент не сопоставлен с CPE"}
}

func flattenCPEMatches(raw json.RawMessage) []nvdCPEMatch {
	var cfgs []nvdConfiguration
	if err := json.Unmarshal(raw, &cfgs); err != nil {
		return nil
	}

	var out []nvdCPEMatch
	for _, cfg := range cfgs {
		for _, node := range cfg.Nodes {
			out = append(out, node.CPEMatch...)
			if len(node.Children) > 0 {
				slog.Debug("nvd cpe: children nodes are not supported in MVP", "children_count", len(node.Children))
			}
		}
	}

	return out
}

func normalize(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, "\\", "")
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, s)
	s = strings.Trim(s, "-")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return s
}

func productsMatch(component, product string) bool {
	if component == product {
		return true
	}

	componentVariants := productAliases(component)
	productVariants := productAliases(product)
	for _, cv := range componentVariants {
		for _, pv := range productVariants {
			if cv == pv {
				return true
			}
			if tokenEqualsWhole(cv, pv) || tokenEqualsWhole(pv, cv) {
				return true
			}
		}
	}

	return false
}

func productAliases(product string) []string {
	base := product
	suffixes := []string{
		"-firmware", "-software", "-hardware",
		"_firmware", "_software", "_hardware",
	}

	out := []string{base}
	for _, sfx := range suffixes {
		if strings.HasSuffix(base, sfx) {
			trimmed := strings.TrimSuffix(base, sfx)
			if trimmed != "" {
				out = append(out, trimmed)
			}
		}
	}

	return out
}

func tokenEqualsWhole(compound, whole string) bool {
	if whole == "" || compound == "" || !strings.Contains(compound, "-") {
		return false
	}
	for _, token := range strings.Split(compound, "-") {
		if token == whole && len(token) >= 4 {
			return true
		}
	}
	return false
}

func extractProduct(criteria string) (string, bool) {
	parts := strings.Split(criteria, ":")
	if len(parts) <= 4 {
		return "", false
	}
	return parts[4], true
}

func checkVersionRange(componentVersion string, cm nvdCPEMatch) (bool, string, bool) {
	v := normalizeVersion(componentVersion)
	if v == "" {
		return false, "версия компонента неизвестна", false
	}

	if cm.VersionStartIncluding != "" {
		cmp, ok := compareVersionsSafe(v, cm.VersionStartIncluding)
		if !ok {
			return false, "не удалось сравнить версии", false
		}
		if cmp < 0 {
			return false, fmt.Sprintf("версия %s ниже %s", componentVersion, cm.VersionStartIncluding), true
		}
	}
	if cm.VersionStartExcluding != "" {
		cmp, ok := compareVersionsSafe(v, cm.VersionStartExcluding)
		if !ok {
			return false, "не удалось сравнить версии", false
		}
		if cmp <= 0 {
			return false, fmt.Sprintf("версия %s ниже %s", componentVersion, cm.VersionStartExcluding), true
		}
	}
	if cm.VersionEndIncluding != "" {
		cmp, ok := compareVersionsSafe(v, cm.VersionEndIncluding)
		if !ok {
			return false, "не удалось сравнить версии", false
		}
		if cmp > 0 {
			return false, fmt.Sprintf("версия %s выше %s", componentVersion, cm.VersionEndIncluding), true
		}
	}
	if cm.VersionEndExcluding != "" {
		cmp, ok := compareVersionsSafe(v, cm.VersionEndExcluding)
		if !ok {
			return false, "не удалось сравнить версии", false
		}
		if cmp >= 0 {
			return false, fmt.Sprintf("версия %s выше %s", componentVersion, cm.VersionEndExcluding), true
		}
	}

	return true, fmt.Sprintf("версия %s в диапазоне %s", componentVersion, formatRange(cm)), true
}

// compareVersions is intentionally simplified for MVP:
// - optional leading 'v' is ignored (v1.2.3 -> 1.2.3)
// - pre-release suffix after '-' is ignored (1.2.3-rc1 -> 1.2.3)
func compareVersions(a, b string) int {
	aa := splitVersion(normalizeVersion(a))
	bb := splitVersion(normalizeVersion(b))

	minLen := len(aa)
	if len(bb) < minLen {
		minLen = len(bb)
	}

	for i := 0; i < minLen; i++ {
		ai, aErr := strconv.Atoi(aa[i])
		bi, bErr := strconv.Atoi(bb[i])
		if aErr == nil && bErr == nil {
			if ai < bi {
				return -1
			}
			if ai > bi {
				return 1
			}
			continue
		}

		cmp := strings.Compare(aa[i], bb[i])
		if cmp < 0 {
			return -1
		}
		if cmp > 0 {
			return 1
		}
	}

	if len(aa) < len(bb) {
		return -1
	}
	if len(aa) > len(bb) {
		return 1
	}
	return 0
}

func compareVersionsSafe(a, b string) (int, bool) {
	na := normalizeVersion(a)
	nb := normalizeVersion(b)
	if na == "" || nb == "" {
		return 0, false
	}
	if !hasComparableSegments(na) || !hasComparableSegments(nb) {
		return 0, false
	}
	return compareVersions(na, nb), true
}

func normalizeVersion(v string) string {
	res := strings.TrimSpace(v)
	res = strings.TrimPrefix(res, "v")
	if idx := strings.Index(res, "-"); idx >= 0 {
		res = res[:idx]
	}
	return res
}

func splitVersion(v string) []string {
	if v == "" {
		return nil
	}
	return strings.Split(v, ".")
}

func hasComparableSegments(v string) bool {
	for _, seg := range strings.Split(v, ".") {
		if seg == "" {
			return false
		}
		for _, ch := range seg {
			if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'z') && (ch < 'A' || ch > 'Z') {
				return false
			}
		}
	}
	return true
}

func formatRange(cm nvdCPEMatch) string {
	left := "("
	start := "−∞"
	if cm.VersionStartIncluding != "" {
		left = "["
		start = cm.VersionStartIncluding
	} else if cm.VersionStartExcluding != "" {
		left = "("
		start = cm.VersionStartExcluding
	}

	right := ")"
	end := "+∞"
	if cm.VersionEndIncluding != "" {
		right = "]"
		end = cm.VersionEndIncluding
	} else if cm.VersionEndExcluding != "" {
		right = ")"
		end = cm.VersionEndExcluding
	}

	return fmt.Sprintf("%s%s, %s%s", left, start, end, right)
}
