package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"redlycoris/internal/domain"
)

type zapReport struct {
	ProgramName string    `json:"@programName"`
	Version     string    `json:"@version"`
	Sites       []zapSite `json:"site"`
}

type zapSite struct {
	Name   string     `json:"@name"`
	Alerts []zapAlert `json:"alerts"`
}

type zapAlert struct {
	PluginID   string        `json:"pluginid"`
	AlertRef   string        `json:"alertRef"`
	Alert      string        `json:"alert"`
	Name       string        `json:"name"`
	RiskCode   string        `json:"riskcode"`
	Confidence string        `json:"confidence"`
	RiskDesc   string        `json:"riskdesc"`
	Desc       string        `json:"desc"`
	Instances  []zapInstance `json:"instances"`
	Solution   string        `json:"solution"`
	OtherInfo  string        `json:"otherinfo"`
	Reference  string        `json:"reference"`
	CWEID      string        `json:"cweid"`
}

type zapInstance struct {
	URI      string `json:"uri"`
	Method   string `json:"method"`
	Param    string `json:"param"`
	Attack   string `json:"attack"`
	Evidence string `json:"evidence"`
	Other    string `json:"otherinfo"`
}

type ZAPParser struct{}

var htmlTagRe = regexp.MustCompile(`<[^>]+>`)

func (p *ZAPParser) CanParse(data []byte) bool {
	var probe struct {
		ProgramName string `json:"@programName"`
		Sites       []any  `json:"site"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(probe.ProgramName), "ZAP") && probe.Sites != nil
}

func (p *ZAPParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	_ = ctx

	var report zapReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.ZAPParser.Parse: unmarshal: %w", err)
	}

	findings := make([]domain.Finding, 0, 128)
	for _, site := range report.Sites {
		siteURL := strings.TrimSpace(site.Name)
		for _, alert := range site.Alerts {
			title := firstNonEmpty(strings.TrimSpace(alert.Alert), strings.TrimSpace(alert.Name), strings.TrimSpace(alert.AlertRef), "ZAP alert")
			description := zapDescription(alert)
			ruleID := emptyToNil(strings.TrimSpace(alert.PluginID))
			ruleName := emptyToNil(firstNonEmpty(strings.TrimSpace(alert.Name), strings.TrimSpace(alert.Alert)))
			cweIDs := zapCWE(alert.CWEID)

			instances := alert.Instances
			if len(instances) == 0 {
				instances = []zapInstance{{URI: siteURL}}
			}

			for _, inst := range instances {
				url := emptyToNil(firstNonEmpty(strings.TrimSpace(inst.URI), siteURL))
				httpMethod := emptyToNil(strings.TrimSpace(inst.Method))
				httpParam := emptyToNil(strings.TrimSpace(inst.Param))
				httpEvidence := zapEvidence(inst)

				f := domain.Finding{
					Kind:         domain.KindDAST,
					Title:        title,
					Description:  description,
					Severity:     mapZAPSeverity(alert.RiskCode),
					Confidence:   mapZAPConfidence(alert.Confidence),
					Status:       domain.StatusOpen,
					RuleID:       ruleID,
					RuleName:     ruleName,
					URL:          url,
					HTTPMethod:   httpMethod,
					HTTPParam:    httpParam,
					HTTPEvidence: httpEvidence,
					CWEIDs:       cweIDs,
					CVEIDs:       []string{},
					SourceType:   "zap",
				}
				f.Fingerprint = domain.CalculateFingerprint(&f)
				findings = append(findings, f)
			}
		}
	}

	return findings, nil
}

func mapZAPSeverity(riskCode string) int {
	switch strings.TrimSpace(riskCode) {
	case "4":
		return domain.SeverityCritical
	case "3":
		return domain.SeverityHigh
	case "2":
		return domain.SeverityMedium
	case "1":
		return domain.SeverityLow
	default:
		return domain.SeverityInfo
	}
}

func mapZAPConfidence(confidence string) int {
	val, err := strconv.Atoi(strings.TrimSpace(confidence))
	if err != nil {
		return 0
	}
	if val < 0 {
		return 0
	}
	if val > 3 {
		return 3
	}
	return val
}

func zapDescription(a zapAlert) string {
	parts := make([]string, 0, 4)
	if s := stripHTML(strings.TrimSpace(a.Desc)); s != "" {
		parts = append(parts, s)
	}
	if s := stripHTML(strings.TrimSpace(a.Solution)); s != "" {
		parts = append(parts, "Solution: "+s)
	}
	if s := stripHTML(strings.TrimSpace(a.OtherInfo)); s != "" {
		parts = append(parts, "Other info: "+s)
	}
	if s := stripHTML(strings.TrimSpace(a.Reference)); s != "" {
		parts = append(parts, "Reference: "+s)
	}
	return strings.Join(parts, "\n\n")
}

func zapEvidence(i zapInstance) []byte {
	payload := map[string]string{}
	if v := strings.TrimSpace(i.Attack); v != "" {
		payload["attack"] = v
	}
	if v := strings.TrimSpace(i.Evidence); v != "" {
		payload["evidence"] = v
	}
	if v := strings.TrimSpace(i.Other); v != "" {
		payload["otherinfo"] = v
	}
	if len(payload) == 0 {
		return nil
	}
	raw, _ := json.Marshal(payload)
	return raw
}

func zapCWE(raw string) []int {
	id, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || id <= 0 {
		return []int{}
	}
	return []int{id}
}

func stripHTML(s string) string {
	s = htmlTagRe.ReplaceAllString(s, " ")
	s = strings.Join(strings.Fields(s), " ")
	return strings.TrimSpace(s)
}
