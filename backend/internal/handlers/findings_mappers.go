package handlers

import (
	"encoding/json"

	v1dto "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
)

// mapFindingListItem converts storage.FindingListItem to DTO Finding
func mapFindingListItem(item storage.FindingListItem) v1dto.Finding {
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
	var assigneeID *string
	if item.AssigneeID.Valid {
		value := item.AssigneeID.UUID.String()
		assigneeID = &value
	}
	var owner *v1dto.Owner
	if item.AssigneeID.Valid && item.AssigneeName.Valid {
		owner = &v1dto.Owner{
			ID:   item.AssigneeID.UUID.String(),
			Name: item.AssigneeName.String,
		}
	}
	var importJobID *string
	if item.ImportJobID.Valid {
		value := item.ImportJobID.UUID.String()
		importJobID = &value
	}
	var duplicateID *uuid.UUID
	if item.DuplicateID.Valid {
		duplicateID = &item.DuplicateID.UUID
	}
	var scannerType *string
	if item.Scanner.Valid {
		value := item.Scanner.String
		scannerType = &value
	}
	var sourceType *string
	if item.SourceType.Valid {
		value := item.SourceType.String
		sourceType = &value
	}
	var lastSeenAt *string
	if item.LastSeenAt.Valid {
		value := item.LastSeenAt.Time.Format(timeFormatRFC3339())
		lastSeenAt = &value
	}
	repeatCount := item.RepeatCount
	occurrence := computeOccurrenceStatus(repeatCount, duplicateID)
	return v1dto.Finding{
		ID:          item.ID.String(),
		Title:       item.Title,
		Severity:    item.Severity,
		Status:      item.Status,
		Category:    item.Category,
		ScannerType: scannerType,
		SourceType:  sourceType,
		Occurrence:  &occurrence,
		LastSeenAt:  lastSeenAt,
		RepeatCount: &repeatCount,
		ProductID:   productID,
		ProductName: productName,
		AssigneeID:  assigneeID,
		Owner:       owner,
		ImportJobID: importJobID,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
	}
}

func mapIntelSummary(summary storage.IntelSummary) *v1dto.IntelSummary {
	if len(summary.Identifiers) == 0 {
		return nil
	}
	resp := &v1dto.IntelSummary{
		Identifiers: summary.Identifiers,
		KEV:         summary.KEV,
	}
	if summary.CVSSScore != nil || summary.CVSSVersion != nil {
		resp.CVSS = &v1dto.IntelCVSS{
			Score:   summary.CVSSScore,
			Version: summary.CVSSVersion,
		}
	}
	if summary.EPSSScore != nil || summary.EPSSPercentile != nil {
		resp.EPSS = &v1dto.IntelEPSS{
			Score:      summary.EPSSScore,
			Percentile: summary.EPSSPercentile,
		}
	}
	if summary.LastRefreshedAt != nil {
		value := summary.LastRefreshedAt.Format(timeFormatRFC3339())
		resp.LastRefreshedAt = &value
	}
	return resp
}

func mapIntelDetail(detail *storage.IntelDetail) *v1dto.IntelDetail {
	if detail == nil {
		return nil
	}
	resp := &v1dto.IntelDetail{
		Identifiers: detail.Identifiers,
		NVD:         detail.NVD,
		EPSS:        detail.EPSS,
		KEV:         detail.KEV,
	}
	if len(detail.References) > 0 {
		resp.References = make([]v1dto.IntelReference, 0, len(detail.References))
		for _, ref := range detail.References {
			resp.References = append(resp.References, v1dto.IntelReference{
				Title: ref.Title,
				URL:   ref.URL,
			})
		}
	}
	if detail.UpdatedAt != nil {
		value := detail.UpdatedAt.Format(timeFormatRFC3339())
		resp.UpdatedAt = &value
	}
	return resp
}

func mapScaDetail(detail *storage.ScaFindingDetail, evidence map[string]interface{}) *v1dto.ScaDetails {
	if detail == nil {
		return nil
	}
	var ecosystem *string
	if detail.Ecosystem.Valid {
		value := detail.Ecosystem.String
		ecosystem = &value
	}
	var purl *string
	if detail.Purl.Valid {
		value := detail.Purl.String
		purl = &value
	}
	var fixedVersion *string
	if detail.FixedVersion.Valid {
		value := detail.FixedVersion.String
		fixedVersion = &value
	}
	var primaryURL *string
	if detail.PrimaryURL.Valid {
		value := detail.PrimaryURL.String
		primaryURL = &value
	}
	var rawSeverity *string
	if detail.RawSeverity.Valid {
		value := detail.RawSeverity.String
		rawSeverity = &value
	}

	references := extractStringSlice(evidence, "references")

	return &v1dto.ScaDetails{
		ComponentName:    detail.ComponentName,
		Ecosystem:        ecosystem,
		Purl:             purl,
		InstalledVersion: detail.InstalledVersion,
		FixedVersion:     fixedVersion,
		VulnerabilityID:  detail.VulnerabilityID,
		PrimaryURL:       primaryURL,
		References:       references,
		RawSeverity:      rawSeverity,
	}
}

func extractStringSlice(data map[string]interface{}, key string) []string {
	if len(data) == 0 {
		return nil
	}
	value, ok := data[key]
	if !ok {
		return nil
	}
	switch typed := value.(type) {
	case []string:
		return typed
	case []interface{}:
		values := make([]string, 0, len(typed))
		for _, item := range typed {
			if str, ok := item.(string); ok && str != "" {
				values = append(values, str)
			}
		}
		if len(values) > 0 {
			return values
		}
	}
	return nil
}

// mapFindingDetail converts storage.FindingDetail to DTO Finding
func mapFindingDetail(item storage.FindingDetail) v1dto.Finding {
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
	var deletedAt *string
	if item.DeletedAt.Valid {
		value := item.DeletedAt.Time.Format(timeFormatRFC3339())
		deletedAt = &value
	}
	var assigneeID *string
	if item.AssigneeID.Valid {
		value := item.AssigneeID.UUID.String()
		assigneeID = &value
	}
	var importJobID *string
	if item.ImportJobID.Valid {
		value := item.ImportJobID.UUID.String()
		importJobID = &value
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
	var endpointMethod *string
	if item.EndpointMethod.Valid {
		value := item.EndpointMethod.String
		endpointMethod = &value
	}
	var endpointPath *string
	if item.EndpointPath.Valid {
		value := item.EndpointPath.String
		endpointPath = &value
	}
	var description *string
	if item.Description.Valid {
		value := item.Description.String
		description = &value
	}
	var firstSeenAt *string
	if item.FirstSeenAt.Valid {
		value := item.FirstSeenAt.Time.Format(timeFormatRFC3339())
		firstSeenAt = &value
	}
	var lastSeenAt *string
	if item.LastSeenAt.Valid {
		value := item.LastSeenAt.Time.Format(timeFormatRFC3339())
		lastSeenAt = &value
	}
	repeatCount := item.RepeatCount
	var duplicateID *uuid.UUID
	if item.DuplicateID.Valid {
		duplicateID = &item.DuplicateID.UUID
	}
	occurrence := computeOccurrenceStatus(repeatCount, duplicateID)
	return v1dto.Finding{
		ID:             item.ID.String(),
		Title:          item.Title,
		Description:    description,
		Fingerprint:    &item.Fingerprint,
		Severity:       item.Severity,
		Status:         item.Status,
		Category:       item.Category,
		SourceType:     sourceType,
		SourceVersion:  sourceVersion,
		EndpointMethod: endpointMethod,
		EndpointPath:   endpointPath,
		Occurrence:     &occurrence,
		FirstSeenAt:    firstSeenAt,
		LastSeenAt:     lastSeenAt,
		RepeatCount:    &repeatCount,
		ProductID:      productID,
		ProductName:    productName,
		AssigneeID:     assigneeID,
		ImportJobID:    importJobID,
		CreatedAt:      item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:      item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:      deletedAt,
	}
}

// mapFindingModel converts models.Finding to DTO Finding
func mapFindingModel(item models.Finding) v1dto.Finding {
	var productID *string
	if item.ProductID != nil {
		value := item.ProductID.String()
		productID = &value
	}
	var assigneeID *string
	if item.AssigneeID != nil {
		value := item.AssigneeID.String()
		assigneeID = &value
	}
	var importJobID *string
	if item.ImportJobID != nil {
		value := item.ImportJobID.String()
		importJobID = &value
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
	var endpointMethod *string
	if item.EndpointMethod != nil {
		value := *item.EndpointMethod
		endpointMethod = &value
	}
	var endpointPath *string
	if item.EndpointPath != nil {
		value := *item.EndpointPath
		endpointPath = &value
	}
	var deletedAt *string
	if item.DeletedAt != nil {
		value := item.DeletedAt.Format(timeFormatRFC3339())
		deletedAt = &value
	}
	repeatCount := item.RepeatCount
	occurrence := computeOccurrenceStatus(repeatCount, item.DuplicateID)
	return v1dto.Finding{
		ID:             item.ID.String(),
		Title:          item.Title,
		Description:    item.Description,
		Fingerprint:    &item.Fingerprint,
		Severity:       item.Severity,
		Status:         item.Status,
		Category:       item.Category,
		SourceType:     sourceType,
		SourceVersion:  sourceVersion,
		EndpointMethod: endpointMethod,
		EndpointPath:   endpointPath,
		Occurrence:     &occurrence,
		FirstSeenAt:    stringPointer(item.FirstSeenAt.Format(timeFormatRFC3339())),
		LastSeenAt:     stringPointer(item.LastSeenAt.Format(timeFormatRFC3339())),
		RepeatCount:    &repeatCount,
		ProductID:      productID,
		AssigneeID:     assigneeID,
		ImportJobID:    importJobID,
		CreatedAt:      item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:      item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:      deletedAt,
	}
}

// mapFindingComments converts a slice of storage.FindingCommentItem to DTO FindingComment slice
func mapFindingComments(items []storage.FindingCommentItem) []v1dto.FindingComment {
	comments := make([]v1dto.FindingComment, 0, len(items))
	for _, item := range items {
		var authorID *string
		if item.AuthorID.Valid {
			value := item.AuthorID.UUID.String()
			authorID = &value
		}
		var author *string
		if item.AuthorUsername.Valid {
			value := item.AuthorUsername.String
			author = &value
		}
		comments = append(comments, v1dto.FindingComment{
			ID:        item.ID.String(),
			AuthorID:  authorID,
			Author:    author,
			Body:      item.Body,
			CreatedAt: item.CreatedAt.Format(timeFormatRFC3339()),
		})
	}
	return comments
}

// mapFindingEvents converts a slice of storage.FindingEventItem to DTO FindingEvent slice
func mapFindingEvents(items []storage.FindingEventItem) []v1dto.FindingEvent {
	events := make([]v1dto.FindingEvent, 0, len(items))
	for _, item := range items {
		var actorID *string
		if item.ActorID.Valid {
			value := item.ActorID.UUID.String()
			actorID = &value
		}
		var actor *string
		if item.ActorUsername.Valid {
			value := item.ActorUsername.String
			actor = &value
		}
		payload := map[string]interface{}{}
		if len(item.Payload) > 0 {
			_ = json.Unmarshal(item.Payload, &payload)
		}
		events = append(events, v1dto.FindingEvent{
			ID:        item.ID.String(),
			ActorID:   actorID,
			Actor:     actor,
			EventType: item.EventType,
			Payload:   payload,
			CreatedAt: item.CreatedAt.Format(timeFormatRFC3339()),
		})
	}
	return events
}

func latestImportedEvidence(events []v1dto.FindingEvent) map[string]interface{} {
	for _, event := range events {
		if event.EventType != "finding.imported" {
			continue
		}
		if len(event.Payload) == 0 {
			continue
		}
		return event.Payload
	}
	return nil
}

func decodeEvidencePayload(payload []byte) map[string]interface{} {
	if len(payload) == 0 {
		return nil
	}
	result := map[string]interface{}{}
	if err := json.Unmarshal(payload, &result); err != nil {
		return nil
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

// mapFindingOccurrences converts a slice of storage.FindingOccurrenceItem to DTO FindingOccurrence slice
func mapFindingOccurrences(items []storage.FindingOccurrenceItem) []v1dto.FindingOccurrence {
	response := make([]v1dto.FindingOccurrence, 0, len(items))
	for _, item := range items {
		var importJobID *string
		if item.ImportJobID.Valid {
			value := item.ImportJobID.UUID.String()
			importJobID = &value
		}
		var scannerType *string
		if item.Scanner.Valid {
			value := item.Scanner.String
			scannerType = &value
		}
		var snippet *string
		if item.Description.Valid {
			value := item.Description.String
			snippet = &value
		}
		response = append(response, v1dto.FindingOccurrence{
			ID:          item.ID.String(),
			ImportJobID: importJobID,
			SeenAt:      item.SeenAt.Format(timeFormatRFC3339()),
			Status:      item.Status,
			ScannerType: scannerType,
			Snippet:     snippet,
		})
	}
	return response
}

// mapDuplicateGroup converts storage.DuplicateGroup to DTO DuplicateGroup
func mapDuplicateGroup(group *storage.DuplicateGroup) *v1dto.DuplicateGroup {
	if group == nil {
		return nil
	}
	duplicates := make([]v1dto.Finding, 0, len(group.Duplicates))
	for _, item := range group.Duplicates {
		duplicates = append(duplicates, mapFindingDetail(item))
	}
	return &v1dto.DuplicateGroup{
		Master:     mapFindingDetail(group.Master),
		Duplicates: duplicates,
	}
}

// computeOccurrenceStatus determines if a finding is NEW or REPEAT
func computeOccurrenceStatus(repeatCount int, duplicateID *uuid.UUID) string {
	if repeatCount > 0 || duplicateID != nil {
		return "REPEAT"
	}
	return "NEW"
}
