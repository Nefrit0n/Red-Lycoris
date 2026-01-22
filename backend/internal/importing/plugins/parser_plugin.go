package plugins

import (
	"encoding/json"

	"lotus-warden/backend/internal/parser"
)

type parserPlugin struct {
	parser         parser.Parser
	detectVersion  func([]byte) string
	detectionScore int
	normalizer     func([]parser.Finding, string) ([]CanonicalFinding, error)
}

func newParserPlugin(parser parser.Parser, detectVersion func([]byte) string, detectionScore int, normalizer func([]parser.Finding, string) ([]CanonicalFinding, error)) ImportPlugin {
	return &parserPlugin{
		parser:         parser,
		detectVersion:  detectVersion,
		detectionScore: detectionScore,
		normalizer:     normalizer,
	}
}

func (p *parserPlugin) ScannerType() string {
	return p.parser.ScannerType()
}

func (p *parserPlugin) DetectReport(data []byte) (bool, string, int) {
	if !p.parser.CanParse(data) {
		return false, "", 0
	}
	version := ""
	if p.detectVersion != nil {
		version = p.detectVersion(data)
	}
	return true, version, p.detectionScore
}

func (p *parserPlugin) Parse(data []byte) ([]parser.Finding, error) {
	return p.parser.Parse(data)
}

func (p *parserPlugin) Normalize(in []parser.Finding, reportVersion string) ([]CanonicalFinding, error) {
	if p.normalizer != nil {
		return p.normalizer(in, reportVersion)
	}
	return normalizeFindings(in)
}

type sarifVersionReport struct {
	Version string `json:"version"`
	Runs    []any  `json:"runs"`
}

func detectSarifVersion(data []byte) string {
	if !json.Valid(data) {
		return ""
	}
	var report sarifVersionReport
	if err := json.Unmarshal(data, &report); err != nil {
		return ""
	}
	if report.Version == "" || len(report.Runs) == 0 {
		return ""
	}
	return report.Version
}

type semgrepVersionReport struct {
	Version string `json:"version"`
}

func detectSemgrepVersion(data []byte) string {
	if version := detectSarifVersion(data); version != "" {
		return version
	}
	if !json.Valid(data) {
		return ""
	}
	var report semgrepVersionReport
	if err := json.Unmarshal(data, &report); err != nil {
		return ""
	}
	return report.Version
}
