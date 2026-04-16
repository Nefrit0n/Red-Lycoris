// Package osv содержит доменную логику обогащения из OSV.
package osv

import (
	"encoding/json"
	"fmt"
	"strings"
)

// RangeEvent — одно событие в версионной истории (introduced, fixed, limit).
type RangeEvent struct {
	Type    string `json:"type"` // "introduced", "fixed", "last_affected", "limit"
	Version string `json:"version"`
}

// VersionRange — один диапазон затронутых версий конкретного пакета.
type VersionRange struct {
	Type         string       `json:"type"` // "SEMVER", "ECOSYSTEM", "GIT"
	Repo         string       `json:"repo,omitempty"`
	Events       []RangeEvent `json:"events"`
	IntroducedIn string       `json:"introduced_in,omitempty"` // первая "introduced"
	FixedIn      string       `json:"fixed_in,omitempty"`      // первая "fixed"
	LastAffected string       `json:"last_affected,omitempty"`
}

// RangeSummary — агрегированная сводка по всем диапазонам.
// Именно это главное для UI: одна строка "Обновитесь до X.Y.Z".
type RangeSummary struct {
	FixedVersions      []string       `json:"fixed_versions,omitempty"`      // все уникальные fixed
	IntroducedVersions []string       `json:"introduced_versions,omitempty"` // для "с какой версии уязвимо"
	HasFix             bool           `json:"has_fix"`
	Ranges             []VersionRange `json:"ranges,omitempty"`
}

// ParseRanges принимает сырой JSONB из osv_vulnerabilities.affected_ranges
// и возвращает структурированную сводку.
//
// Формат affected_ranges из OSV:
//
//	[
//	  {
//	    "type": "SEMVER",
//	    "events": [
//	      {"introduced": "0.2.0"},
//	      {"fixed": "8.0.0"}
//	    ]
//	  }
//	]
//
// (Заметь: в OSV event это объект с ОДНИМ ключом из набора
// introduced/fixed/last_affected/limit — парсер должен это учесть.)
func ParseRanges(raw json.RawMessage) (RangeSummary, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return RangeSummary{}, nil
	}

	var rawRanges []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &rawRanges); err != nil {
		return RangeSummary{}, fmt.Errorf("osv.ParseRanges: unmarshal: %w", err)
	}

	var result RangeSummary
	fixedSeen := make(map[string]struct{})
	introSeen := make(map[string]struct{})

	for _, r := range rawRanges {
		rng := VersionRange{}

		if t, ok := r["type"]; ok {
			_ = json.Unmarshal(t, &rng.Type)
		}
		if repo, ok := r["repo"]; ok {
			_ = json.Unmarshal(repo, &rng.Repo)
		}

		if eventsRaw, ok := r["events"]; ok {
			var rawEvents []map[string]string
			if err := json.Unmarshal(eventsRaw, &rawEvents); err == nil {
				for _, ev := range rawEvents {
					// В OSV события приходят как объекты с одним ключом:
					// {"introduced": "1.0.0"} или {"fixed": "2.0.0"}
					for k, v := range ev {
						v = strings.TrimSpace(v)
						if v == "" {
							continue
						}
						rng.Events = append(rng.Events, RangeEvent{
							Type:    k,
							Version: v,
						})
						switch k {
						case "introduced":
							if rng.IntroducedIn == "" {
								rng.IntroducedIn = v
							}
							if _, dup := introSeen[v]; !dup && v != "0" {
								introSeen[v] = struct{}{}
								result.IntroducedVersions = append(result.IntroducedVersions, v)
							}
						case "fixed":
							if rng.FixedIn == "" {
								rng.FixedIn = v
							}
							if _, dup := fixedSeen[v]; !dup {
								fixedSeen[v] = struct{}{}
								result.FixedVersions = append(result.FixedVersions, v)
							}
						case "last_affected":
							if rng.LastAffected == "" {
								rng.LastAffected = v
							}
						}
					}
				}
			}
		}

		result.Ranges = append(result.Ranges, rng)
	}

	result.HasFix = len(result.FixedVersions) > 0
	return result, nil
}
