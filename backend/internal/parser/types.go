package parser

type Finding struct {
	Title       string         `json:"title"`
	Description *string        `json:"description,omitempty"`
	Severity    string         `json:"severity"`
	Location    string         `json:"location,omitempty"`
	RuleID      string         `json:"rule_id,omitempty"`
	RawData     map[string]any `json:"raw_data,omitempty"`
	Evidence    map[string]any `json:"evidence,omitempty"`
}

type Parser interface {
	ScannerType() string
	CanParse(data []byte) bool
	Parse(data []byte) ([]Finding, error)
}
