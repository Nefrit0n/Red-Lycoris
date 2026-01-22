package parser

import (
	"encoding/json"
	"strconv"
	"strings"

	"lotus-warden/backend/internal/models"
)

type ZapParser struct{}

func (p *ZapParser) ScannerType() string {
	return "zap"
}

func (p *ZapParser) CanParse(data []byte) bool {
	if canParseSarif(data) {
		return true
	}
	if !json.Valid(data) {
		return false
	}
	var report struct {
		Site []any `json:"site"`
	}
	if err := json.Unmarshal(data, &report); err != nil {
		return false
	}
	return len(report.Site) > 0
}

func (p *ZapParser) Parse(data []byte) ([]Finding, error) {
	if canParseSarif(data) {
		return parseSarif(data, "zap")
	}
	var report struct {
		Site []struct {
			Name   string `json:"name"`
			Alerts []struct {
				Alert    string `json:"alert"`
				Desc     string `json:"desc"`
				RiskCode string `json:"riskcode"`
				RiskDesc string `json:"riskdesc"`
				URI      string `json:"uri"`
				PluginID string `json:"pluginid"`
			} `json:"alerts"`
		} `json:"site"`
	}
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, err
	}

	findings := []Finding{}
	for _, site := range report.Site {
		for _, alert := range site.Alerts {
			desc := strings.TrimSpace(alert.Desc)
			var descPtr *string
			if desc != "" {
				descPtr = &desc
			}
			findings = append(findings, Finding{
				Category:    models.CategoryConfig,
				Title:       alert.Alert,
				Description: descPtr,
				Severity:    mapZapSeverity(alert.RiskCode, alert.RiskDesc),
				Location:    alert.URI,
				RuleID:      alert.PluginID,
				RawData: map[string]any{
					"site":     site.Name,
					"riskcode": alert.RiskCode,
				},
			})
		}
	}
	return findings, nil
}

func mapZapSeverity(riskCode, riskDesc string) string {
	if riskCode != "" {
		if value, err := strconv.Atoi(riskCode); err == nil {
			switch value {
			case 3:
				return "high"
			case 2:
				return "medium"
			case 1:
				return "low"
			default:
				return "low"
			}
		}
	}
	switch strings.ToLower(strings.TrimSpace(riskDesc)) {
	case "high":
		return "high"
	case "medium":
		return "medium"
	case "low", "informational":
		return "low"
	default:
		return "low"
	}
}
