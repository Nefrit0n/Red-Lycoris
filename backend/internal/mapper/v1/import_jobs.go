package v1

import (
	"time"

	v1dto "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"
)

func ImportJobListItem(item storage.ImportJobListItem) v1dto.ImportJobListItemDTO {
	var startedAt *string
	if item.StartedAt.Valid {
		value := item.StartedAt.Time.Format(time.RFC3339)
		startedAt = &value
	}
	var finishedAt *string
	if item.FinishedAt.Valid {
		value := item.FinishedAt.Time.Format(time.RFC3339)
		finishedAt = &value
	}
	var productID *string
	if item.ProductID.Valid {
		value := item.ProductID.UUID.String()
		productID = &value
	}
	var productName *string
	if item.ProductName.Valid {
		value := item.ProductName.String
		productName = &value
	}
	var productVersion *string
	if item.ProductVersion.Valid {
		value := item.ProductVersion.String
		productVersion = &value
	}
	var productIdentifier *string
	if item.ProductIdentifier.Valid {
		value := item.ProductIdentifier.String
		productIdentifier = &value
	}
	var createdBy *string
	if item.CreatedBy.Valid {
		value := item.CreatedBy.UUID.String()
		createdBy = &value
	}
	var sourceType *string
	if item.SourceType.Valid {
		value := item.SourceType.String
		sourceType = &value
	}
	var sourceVersion *string
	if item.SourceVersion.Valid {
		value := item.SourceVersion.String
		sourceVersion = &value
	}
	return v1dto.ImportJobListItemDTO{
		ID:                item.ID.String(),
		Scanner:           item.Scanner,
		SourceType:        sourceType,
		SourceVersion:     sourceVersion,
		Status:            item.Status,
		Progress:          importJobProgress(item.Status),
		FindingsTotal:     item.FindingsTotal,
		FindingsNew:       item.FindingsNew,
		DuplicatesTotal:   item.DuplicatesTotal,
		Checksum:          item.Checksum,
		CreatedAt:         item.CreatedAt.Format(time.RFC3339),
		StartedAt:         startedAt,
		FinishedAt:        finishedAt,
		ProductID:         productID,
		ProductName:       productName,
		ProductVersion:    productVersion,
		ProductIdentifier: productIdentifier,
		CreatedBy:         createdBy,
	}
}

func ImportJobDetail(item storage.ImportJobDetail) v1dto.ImportJobDetailDTO {
	resp := v1dto.ImportJobDetailDTO{
		ImportJobListItemDTO: ImportJobListItem(item.ImportJobListItem),
	}
	if item.ErrorMessage.Valid {
		message := item.ErrorMessage.String
		resp.ErrorMessage = &message
		resp.ErrorSummary = &v1dto.ImportJobErrorSummary{Message: message}
	}
	return resp
}

func ImportJobFromModel(item models.ImportJob) v1dto.ImportJobDetailDTO {
	var startedAt *string
	if item.StartedAt != nil {
		value := item.StartedAt.Format(time.RFC3339)
		startedAt = &value
	}
	var finishedAt *string
	if item.FinishedAt != nil {
		value := item.FinishedAt.Format(time.RFC3339)
		finishedAt = &value
	}
	var productID *string
	if item.ProductID != nil {
		value := item.ProductID.String()
		productID = &value
	}
	var productName *string
	if item.ProductName != nil {
		value := *item.ProductName
		productName = &value
	}
	var productVersion *string
	if item.ProductVersion != nil {
		value := *item.ProductVersion
		productVersion = &value
	}
	var productIdentifier *string
	if item.ProductIdentifier != nil {
		value := *item.ProductIdentifier
		productIdentifier = &value
	}
	var createdBy *string
	if item.CreatedBy != nil {
		value := item.CreatedBy.String()
		createdBy = &value
	}
	var sourceType *string
	if item.SourceType != nil {
		value := *item.SourceType
		sourceType = &value
	}
	var sourceVersion *string
	if item.SourceVersion != nil {
		value := *item.SourceVersion
		sourceVersion = &value
	}
	resp := v1dto.ImportJobDetailDTO{
		ImportJobListItemDTO: v1dto.ImportJobListItemDTO{
			ID:                item.ID.String(),
			Scanner:           item.Scanner,
			SourceType:        sourceType,
			SourceVersion:     sourceVersion,
			Status:            item.Status,
			Progress:          importJobProgress(item.Status),
			FindingsTotal:     item.FindingsTotal,
			FindingsNew:       item.FindingsNew,
			DuplicatesTotal:   item.DuplicatesTotal,
			Checksum:          item.Checksum,
			CreatedAt:         item.CreatedAt.Format(time.RFC3339),
			StartedAt:         startedAt,
			FinishedAt:        finishedAt,
			ProductID:         productID,
			ProductName:       productName,
			ProductVersion:    productVersion,
			ProductIdentifier: productIdentifier,
			CreatedBy:         createdBy,
		},
	}
	if item.ErrorMessage != nil && *item.ErrorMessage != "" {
		message := *item.ErrorMessage
		resp.ErrorMessage = &message
		resp.ErrorSummary = &v1dto.ImportJobErrorSummary{Message: message}
	}
	return resp
}

func importJobProgress(status string) int {
	switch status {
	case models.ImportJobQueued:
		return 0
	case models.ImportJobRunning:
		return 50
	case models.ImportJobSucceeded, models.ImportJobFailed:
		return 100
	default:
		return 0
	}
}
