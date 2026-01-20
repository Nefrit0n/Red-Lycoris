package handlers

import (
	"encoding/json"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
)

// mapFindingListItem converts storage.FindingListItem to FindingResponse
func mapFindingListItem(item storage.FindingListItem) FindingResponse {
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
	var owner *OwnerResponse
	if item.AssigneeID.Valid && item.AssigneeName.Valid {
		owner = &OwnerResponse{
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
	var lastSeenAt *string
	if item.LastSeenAt.Valid {
		value := item.LastSeenAt.Time.Format(timeFormatRFC3339())
		lastSeenAt = &value
	}
	repeatCount := item.RepeatCount
	occurrence := computeOccurrenceStatus(repeatCount, duplicateID)
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Severity:    item.Severity,
		Status:      item.Status,
		ScannerType: scannerType,
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

func mapIntelSummary(summary storage.IntelSummary) *IntelSummaryResponse {
	if len(summary.Identifiers) == 0 {
		return nil
	}
	resp := &IntelSummaryResponse{
		Identifiers: summary.Identifiers,
		KEV:         summary.KEV,
	}
	if summary.CVSSScore != nil || summary.CVSSVersion != nil {
		resp.CVSS = &IntelCVSSResponse{
			Score:   summary.CVSSScore,
			Version: summary.CVSSVersion,
		}
	}
	if summary.EPSSScore != nil || summary.EPSSPercentile != nil {
		resp.EPSS = &IntelEPSSResponse{
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

func mapIntelDetail(detail *storage.IntelDetail) *IntelDetailResponse {
	if detail == nil {
		return nil
	}
	resp := &IntelDetailResponse{
		Identifiers: detail.Identifiers,
		NVD:         detail.NVD,
		EPSS:        detail.EPSS,
		KEV:         detail.KEV,
	}
	if len(detail.References) > 0 {
		resp.References = make([]IntelReferenceResponse, 0, len(detail.References))
		for _, ref := range detail.References {
			resp.References = append(resp.References, IntelReferenceResponse{
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

// mapFindingDetail converts storage.FindingDetail to FindingResponse
func mapFindingDetail(item storage.FindingDetail) FindingResponse {
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
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Description: description,
		Fingerprint: &item.Fingerprint,
		Severity:    item.Severity,
		Status:      item.Status,
		Occurrence:  &occurrence,
		FirstSeenAt: firstSeenAt,
		LastSeenAt:  lastSeenAt,
		RepeatCount: &repeatCount,
		ProductID:   productID,
		ProductName: productName,
		AssigneeID:  assigneeID,
		ImportJobID: importJobID,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:   deletedAt,
	}
}

// mapFindingModel converts models.Finding to FindingResponse
func mapFindingModel(item models.Finding) FindingResponse {
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
	var deletedAt *string
	if item.DeletedAt != nil {
		value := item.DeletedAt.Format(timeFormatRFC3339())
		deletedAt = &value
	}
	repeatCount := item.RepeatCount
	occurrence := computeOccurrenceStatus(repeatCount, item.DuplicateID)
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Description: item.Description,
		Fingerprint: &item.Fingerprint,
		Severity:    item.Severity,
		Status:      item.Status,
		Occurrence:  &occurrence,
		FirstSeenAt: stringPointer(item.FirstSeenAt.Format(timeFormatRFC3339())),
		LastSeenAt:  stringPointer(item.LastSeenAt.Format(timeFormatRFC3339())),
		RepeatCount: &repeatCount,
		ProductID:   productID,
		AssigneeID:  assigneeID,
		ImportJobID: importJobID,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:   deletedAt,
	}
}

// mapFindingComments converts a slice of storage.FindingCommentItem to FindingCommentResponse slice
func mapFindingComments(items []storage.FindingCommentItem) []FindingCommentResponse {
	comments := make([]FindingCommentResponse, 0, len(items))
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
		comments = append(comments, FindingCommentResponse{
			ID:        item.ID.String(),
			AuthorID:  authorID,
			Author:    author,
			Body:      item.Body,
			CreatedAt: item.CreatedAt.Format(timeFormatRFC3339()),
		})
	}
	return comments
}

// mapFindingEvents converts a slice of storage.FindingEventItem to FindingEventResponse slice
func mapFindingEvents(items []storage.FindingEventItem) []FindingEventResponse {
	events := make([]FindingEventResponse, 0, len(items))
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
		events = append(events, FindingEventResponse{
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

func latestImportedEvidence(events []FindingEventResponse) map[string]interface{} {
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

// mapFindingOccurrences converts a slice of storage.FindingOccurrenceItem to FindingOccurrenceResponse slice
func mapFindingOccurrences(items []storage.FindingOccurrenceItem) []FindingOccurrenceResponse {
	response := make([]FindingOccurrenceResponse, 0, len(items))
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
		response = append(response, FindingOccurrenceResponse{
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

// mapDuplicateGroup converts storage.DuplicateGroup to DuplicateGroupResponse
func mapDuplicateGroup(group *storage.DuplicateGroup) *DuplicateGroupResponse {
	if group == nil {
		return nil
	}
	duplicates := make([]FindingResponse, 0, len(group.Duplicates))
	for _, item := range group.Duplicates {
		duplicates = append(duplicates, mapFindingDetail(item))
	}
	return &DuplicateGroupResponse{
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
