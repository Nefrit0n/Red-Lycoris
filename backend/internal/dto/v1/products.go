package v1

type ProductListItemDTO struct {
	ID                string  `json:"id"`
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
