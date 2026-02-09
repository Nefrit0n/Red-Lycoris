package plugins

import "red-lycoris/backend/internal/parser"

// CanonicalFinding represents the normalized, scanner-agnostic finding payload.
// Category/Kind are kept for future extensibility, while legacy processing uses Category.
type CanonicalFinding struct {
	Category    string
	Kind        string
	Title       string
	Description *string
	Severity    string
	Location    string
	RuleID      string
	Evidence    map[string]any
	RawData     map[string]any
	Identifiers []string
}

// ImportPlugin defines the pipeline hooks for a given scanner type.
type ImportPlugin interface {
	ScannerType() string
	DetectReport(data []byte) (ok bool, reportVersion string, score int)
	Parse(data []byte) ([]parser.Finding, error)
	Normalize(in []parser.Finding, reportVersion string) ([]CanonicalFinding, error)
}
