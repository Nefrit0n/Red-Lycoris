package events

const (
	IntelStreamName           = "INTEL"
	IntelSubject              = "intel.>"
	IntelEnrichRequested      = "intel.enrich.requested"
	IntelEnriched             = "intel.enriched"
	DefaultIntelSourceVersion = "v1"
)

type IntelEnrichRequest struct {
	Identifiers []string `json:"identifiers"`
	ProductID   *string  `json:"product_id,omitempty"`
	Source      string   `json:"source,omitempty"`
}
