package events

type RiskRecomputeRequest struct {
	TenantID  *string `json:"tenant_id,omitempty"`
	FindingID string  `json:"finding_id"`
	Source    string  `json:"source"`
	Cause     string  `json:"cause,omitempty"`
}
