package intel

import (
	"regexp"
	"sort"
	"strings"

	"lotus-warden/backend/internal/parser"
)

var (
	cveRegex  = regexp.MustCompile(`(?i)\bCVE-\d{4}-\d{4,7}\b`)
	ghsaRegex = regexp.MustCompile(`(?i)\bGHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}\b`)
	osvRegex  = regexp.MustCompile(`(?i)\bOSV-[a-z0-9\-]{4,}\b`)
	cweRegex  = regexp.MustCompile(`(?i)\bCWE-\d{1,5}\b`)
)

func NormalizeIdentifiers(values ...string) []string {
	unique := map[string]struct{}{}
	for _, value := range values {
		if value == "" {
			continue
		}
		for _, match := range cveRegex.FindAllString(value, -1) {
			unique[strings.ToUpper(match)] = struct{}{}
		}
		for _, match := range ghsaRegex.FindAllString(value, -1) {
			unique[strings.ToUpper(match)] = struct{}{}
		}
		for _, match := range osvRegex.FindAllString(value, -1) {
			unique[strings.ToUpper(match)] = struct{}{}
		}
		for _, match := range cweRegex.FindAllString(value, -1) {
			unique[strings.ToUpper(match)] = struct{}{}
		}
	}
	return sortedKeys(unique)
}

func IsCVE(identifier string) bool {
	return cveRegex.MatchString(identifier)
}

func IsGHSA(identifier string) bool {
	return ghsaRegex.MatchString(identifier)
}

func IsOSV(identifier string) bool {
	return osvRegex.MatchString(identifier)
}

func IsCWE(identifier string) bool {
	return cweRegex.MatchString(identifier)
}

func ExtractIdentifiersFromFinding(finding parser.Finding) []string {
	values := []string{finding.RuleID, finding.Title}
	if finding.Description != nil {
		values = append(values, *finding.Description)
	}
	values = append(values, extractStringValues(finding.RawData)...)
	values = append(values, extractStringValues(finding.Evidence)...)
	return NormalizeIdentifiers(values...)
}

func extractStringValues(data map[string]any) []string {
	if len(data) == 0 {
		return nil
	}
	values := make([]string, 0, len(data))
	for _, value := range data {
		switch typed := value.(type) {
		case string:
			values = append(values, typed)
		case []string:
			values = append(values, typed...)
		case []any:
			for _, item := range typed {
				if str, ok := item.(string); ok {
					values = append(values, str)
				}
			}
		case map[string]any:
			values = append(values, extractStringValues(typed)...)
		}
	}
	return values
}

func sortedKeys(values map[string]struct{}) []string {
	if len(values) == 0 {
		return nil
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
