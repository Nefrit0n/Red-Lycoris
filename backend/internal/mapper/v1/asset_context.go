package v1

import (
	"encoding/json"

	v1dto "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/storage"
)

func ProductAssetContext(item storage.ProductAssetContext) v1dto.ProductAssetContextDTO {
	var tenantID *string
	if item.TenantID != nil {
		value := item.TenantID.String()
		tenantID = &value
	}
	environment := item.Environment
	internetExposed := item.InternetExposed
	dataClassification := item.DataClassification

	var businessImpact *string
	if item.BusinessImpact != nil {
		businessImpact = item.BusinessImpact
	}

	var tags []string
	if len(item.Tags) > 0 {
		tags = item.Tags
	}

	var metadata map[string]interface{}
	if len(item.Metadata) > 0 {
		_ = json.Unmarshal(item.Metadata, &metadata)
	}

	return v1dto.ProductAssetContextDTO{
		ProductID:          item.ProductID.String(),
		TenantID:           tenantID,
		Environment:        &environment,
		InternetExposed:    &internetExposed,
		DataClassification: &dataClassification,
		BusinessImpact:     businessImpact,
		Tags:               tags,
		Metadata:           metadata,
	}
}
