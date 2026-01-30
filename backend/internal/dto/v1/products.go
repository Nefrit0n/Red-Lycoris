package v1

type ProductListItemDTO struct {
	ID                string  `json:"id"`
	TenantID          *string `json:"tenantId,omitempty"`
	Name              string  `json:"name"`
	Identifier        *string `json:"identifier,omitempty"`
	Version           *string `json:"version,omitempty"`
	AssetCriticality  *string `json:"assetCriticality,omitempty"`
	LastScanAt        *string `json:"lastScanAt,omitempty"`
	FindingsOpenCount int     `json:"findingsOpenCount"`
}

type ProductDetailDTO struct {
	ProductListItemDTO
	Description *string `json:"description,omitempty"`
}

type ProductStatsDTO struct {
	OpenCount          int            `json:"openCount"`
	MitigatedCount     int            `json:"mitigatedCount"`
	FalsePositiveCount int            `json:"falsePositiveCount"`
	SeverityCounts     map[string]int `json:"severityCounts"`
}
