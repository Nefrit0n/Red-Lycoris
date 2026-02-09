package v1

import (
	"time"

	v1dto "red-lycoris/backend/internal/dto/v1"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/storage"
)

func ProductListItem(item storage.ProductListItem) v1dto.ProductListItemDTO {
	var tenantID *string
	if item.TenantID.Valid {
		value := item.TenantID.UUID.String()
		tenantID = &value
	}
	var identifier *string
	if item.Identifier.Valid {
		value := item.Identifier.String
		identifier = &value
	}
	var version *string
	if item.Version.Valid {
		value := item.Version.String
		version = &value
	}
	var assetCriticality *string
	if item.AssetCriticality.Valid {
		value := item.AssetCriticality.String
		assetCriticality = &value
	}
	var lastScanAt *string
	if item.LastScanAt.Valid {
		value := item.LastScanAt.Time.Format(time.RFC3339)
		lastScanAt = &value
	}
	return v1dto.ProductListItemDTO{
		ID:                item.ID.String(),
		TenantID:          tenantID,
		Name:              item.Name,
		Identifier:        identifier,
		Version:           version,
		AssetCriticality:  assetCriticality,
		LastScanAt:        lastScanAt,
		FindingsOpenCount: item.FindingsOpenCount,
	}
}

func ProductDetailFromListItem(item storage.ProductListItem) v1dto.ProductDetailDTO {
	return v1dto.ProductDetailDTO{
		ProductListItemDTO: ProductListItem(item),
	}
}

func ProductDetail(item models.Product, findingsOpenCount int, lastScanAt *time.Time) v1dto.ProductDetailDTO {
	var tenantID *string
	if item.TenantID != nil {
		value := item.TenantID.String()
		tenantID = &value
	}
	var identifier *string
	if item.Identifier != nil && *item.Identifier != "" {
		identifier = item.Identifier
	}
	var version *string
	if item.Version != nil && *item.Version != "" {
		version = item.Version
	}
	var assetCriticality *string
	if item.AssetCriticality != nil && *item.AssetCriticality != "" {
		assetCriticality = item.AssetCriticality
	}
	var lastScanAtStr *string
	if lastScanAt != nil {
		value := lastScanAt.Format(time.RFC3339)
		lastScanAtStr = &value
	}
	return v1dto.ProductDetailDTO{
		ProductListItemDTO: v1dto.ProductListItemDTO{
			ID:                item.ID.String(),
			TenantID:          tenantID,
			Name:              item.Name,
			Identifier:        identifier,
			Version:           version,
			AssetCriticality:  assetCriticality,
			LastScanAt:        lastScanAtStr,
			FindingsOpenCount: findingsOpenCount,
		},
		Description: item.Description,
	}
}
