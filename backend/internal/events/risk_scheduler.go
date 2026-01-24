package events

import "time"

const (
	IntelEPSSRefreshedSubject = "intel.epss.refreshed.v1"
	IntelKEVRefreshedSubject  = "intel.kev.refreshed.v1"
	IntelNVDRefreshedSubject  = "intel.nvd.refreshed.v1"

	AssetContextUpdatedSubject = "asset_context.updated.v1"

	RiskModelActivatedSubject = "risk.model.activated.v1"
)

type IntelEPSSRefreshedEvent struct {
	Date             string    `json:"date"`
	UpdatedAt        time.Time `json:"updated_at"`
	CountRowsTouched int       `json:"count_rows_touched"`
}

type IntelKEVRefreshedEvent struct {
	Date             string    `json:"date"`
	UpdatedAt        time.Time `json:"updated_at"`
	CountRowsTouched int       `json:"count_rows_touched"`
}

type IntelNVDRefreshedEvent struct {
	From             time.Time `json:"from"`
	To               time.Time `json:"to"`
	UpdatedAt        time.Time `json:"updated_at"`
	CountRowsTouched int       `json:"count_rows_touched"`
}

type AssetContextUpdatedEvent struct {
	ProductID string    `json:"product_id"`
	TenantID  string    `json:"tenant_id"`
	UpdatedAt time.Time `json:"updated_at"`
}

type RiskModelActivatedEvent struct {
	ModelVersion string    `json:"model_version"`
	ActivatedAt  time.Time `json:"activated_at"`
	TenantID     *string   `json:"tenant_id,omitempty"`
}
