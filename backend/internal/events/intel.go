package events

import "github.com/nats-io/nats.go"

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

func EnsureIntelConsumer(js nats.JetStreamContext, durable string) error {
	_, err := ensureConsumerForSubject(js, IntelStreamName, durable, IntelEnrichRequested)
	if err != nil {
		return err
	}
	return nil
}
