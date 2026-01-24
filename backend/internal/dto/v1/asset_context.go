package v1

type ProductAssetContextDTO struct {
	ProductID          string                 `json:"productId"`
	TenantID           *string                `json:"tenantId,omitempty"`
	Environment        *string                `json:"environment,omitempty"`
	InternetExposed    *bool                  `json:"internetExposed,omitempty"`
	DataClassification *string                `json:"dataClassification,omitempty"`
	BusinessImpact     *string                `json:"businessImpact,omitempty"`
	Tags               []string               `json:"tags,omitempty"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
}
