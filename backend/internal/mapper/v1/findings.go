package v1

import (
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	v1dto "red-lycoris/backend/internal/dto/v1"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/sla"
	"red-lycoris/backend/internal/storage"

	"github.com/google/uuid"
)

const timeFormatRFC3339 = time.RFC3339

func FindingListItem(item storage.FindingListItem) v1dto.FindingListItemDTO {
	var tenantID *string
	if item.TenantID.Valid {
		value := item.TenantID.UUID.String()
		tenantID = &value
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
	var policyDecision *string
	if item.PolicyDecision.Valid {
		value := item.PolicyDecision.String
		policyDecision = &value
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
	var firstSeenAt *string
	if item.FirstSeenAt.Valid {
		value := item.FirstSeenAt.Time.Format(timeFormatRFC3339)
		firstSeenAt = &value
	}
	var lastSeenAt *string
	if item.LastSeenAt.Valid {
		value := item.LastSeenAt.Time.Format(timeFormatRFC3339)
		lastSeenAt = &value
	}
	var slaDueAt *string
	var slaBreached *bool
	var slaBreachedAt *string
	var slaProfile *string
	var slaSource *string
	var slaDaysRemaining *int
	if item.SLADueAt.Valid {
		value := item.SLADueAt.Time.Format(timeFormatRFC3339)
		slaDueAt = &value
		slaDaysRemaining = sla.DaysRemaining(&item.SLADueAt.Time, time.Now().UTC())
	}
	if item.SLABreached.Valid {
		value := item.SLABreached.Bool
		slaBreached = &value
	}
	if item.SLABreachedAt.Valid {
		value := item.SLABreachedAt.Time.Format(timeFormatRFC3339)
		slaBreachedAt = &value
	}
	if item.SLAProfile.Valid {
		value := item.SLAProfile.String
		slaProfile = &value
	}
	if item.SLASource.Valid {
		value := item.SLASource.String
		slaSource = &value
	}
	var riskScore *float64
	if item.RiskScore.Valid {
		value := item.RiskScore.Float64
		riskScore = &value
	}
	var riskBand *string
	if item.RiskBand.Valid {
		value := item.RiskBand.String
		riskBand = &value
	}
	var riskUpdatedAt *string
	if item.RiskUpdatedAt.Valid {
		value := item.RiskUpdatedAt.Time.Format(timeFormatRFC3339)
		riskUpdatedAt = &value
	}
	var riskModelVersion *string
	if item.RiskModel.Valid {
		value := item.RiskModel.String
		riskModelVersion = &value
	}
	repeatCount := item.RepeatCount
	occurrence := computeOccurrenceStatus(repeatCount, duplicateID)

	cwe := item.CWE
	owasp := item.OWASP

	return v1dto.FindingListItemDTO{
		ID:               item.ID.String(),
		TenantID:         tenantID,
		Title:            item.Title,
		Severity:         item.Severity,
		Status:           item.Status,
		Category:         item.Category,
		ScannerType:      scannerType,
		SourceType:       sourceType,
		Occurrence:       &occurrence,
		PolicyDecision:   policyDecision,
		FirstSeenAt:      firstSeenAt,
		LastSeenAt:       lastSeenAt,
		RepeatCount:      &repeatCount,
		SLADueAt:         slaDueAt,
		SLABreached:      slaBreached,
		SLABreachedAt:    slaBreachedAt,
		SLAProfile:       slaProfile,
		SLASource:        slaSource,
		SLADaysRemaining: slaDaysRemaining,
		ProductID:        productID,
		ProductName:      productName,
		AssigneeID:       assigneeID,
		Owner:            owner,
		ImportJobID:      importJobID,
		CreatedAt:        item.CreatedAt.Format(timeFormatRFC3339),
		UpdatedAt:        item.UpdatedAt.Format(timeFormatRFC3339),
		RiskScore:        riskScore,
		RiskBand:         riskBand,
		RiskUpdatedAt:    riskUpdatedAt,
		RiskModelVersion: riskModelVersion,
		CWE:              cwe,
		OWASP:            owasp,
	}
}

func FindingDetail(item storage.FindingDetail) v1dto.FindingDetailDTO {
	var tenantID *string
	if item.TenantID.Valid {
		value := item.TenantID.UUID.String()
		tenantID = &value
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
	var deletedAt *string
	if item.DeletedAt.Valid {
		value := item.DeletedAt.Time.Format(timeFormatRFC3339)
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
		value := item.FirstSeenAt.Time.Format(timeFormatRFC3339)
		firstSeenAt = &value
	}
	var lastSeenAt *string
	if item.LastSeenAt.Valid {
		value := item.LastSeenAt.Time.Format(timeFormatRFC3339)
		lastSeenAt = &value
	}
	var slaDueAt *string
	var slaBreached *bool
	var slaBreachedAt *string
	var slaProfile *string
	var slaSource *string
	var slaDaysRemaining *int
	if item.SLADueAt.Valid {
		value := item.SLADueAt.Time.Format(timeFormatRFC3339)
		slaDueAt = &value
		slaDaysRemaining = sla.DaysRemaining(&item.SLADueAt.Time, time.Now().UTC())
	}
	if item.SLABreached.Valid {
		value := item.SLABreached.Bool
		slaBreached = &value
	}
	if item.SLABreachedAt.Valid {
		value := item.SLABreachedAt.Time.Format(timeFormatRFC3339)
		slaBreachedAt = &value
	}
	if item.SLAProfile.Valid {
		value := item.SLAProfile.String
		slaProfile = &value
	}
	if item.SLASource.Valid {
		value := item.SLASource.String
		slaSource = &value
	}
	var riskScore *float64
	if item.RiskScore.Valid {
		value := item.RiskScore.Float64
		riskScore = &value
	}
	var riskBand *string
	if item.RiskBand.Valid {
		value := item.RiskBand.String
		riskBand = &value
	}
	var riskUpdatedAt *string
	if item.RiskUpdatedAt.Valid {
		value := item.RiskUpdatedAt.Time.Format(timeFormatRFC3339)
		riskUpdatedAt = &value
	}
	var riskModelVersion *string
	if item.RiskModel.Valid {
		value := item.RiskModel.String
		riskModelVersion = &value
	}
	repeatCount := item.RepeatCount
	var duplicateID *uuid.UUID
	if item.DuplicateID.Valid {
		duplicateID = &item.DuplicateID.UUID
	}
	occurrence := computeOccurrenceStatus(repeatCount, duplicateID)
	return v1dto.FindingDetailDTO{
		FindingListItemDTO: v1dto.FindingListItemDTO{
			ID:               item.ID.String(),
			TenantID:         tenantID,
			Title:            item.Title,
			Severity:         item.Severity,
			Status:           item.Status,
			Category:         item.Category,
			Occurrence:       &occurrence,
			FirstSeenAt:      firstSeenAt,
			LastSeenAt:       lastSeenAt,
			RepeatCount:      &repeatCount,
			SLADueAt:         slaDueAt,
			SLABreached:      slaBreached,
			SLABreachedAt:    slaBreachedAt,
			SLAProfile:       slaProfile,
			SLASource:        slaSource,
			SLADaysRemaining: slaDaysRemaining,
			ProductID:        productID,
			ProductName:      productName,
			AssigneeID:       assigneeID,
			ImportJobID:      importJobID,
			CreatedAt:        item.CreatedAt.Format(timeFormatRFC3339),
			UpdatedAt:        item.UpdatedAt.Format(timeFormatRFC3339),
			RiskScore:        riskScore,
			RiskBand:         riskBand,
			RiskUpdatedAt:    riskUpdatedAt,
			RiskModelVersion: riskModelVersion,
		},
		Description:    description,
		Fingerprint:    &item.Fingerprint,
		SourceType:     sourceType,
		SourceVersion:  sourceVersion,
		EndpointMethod: endpointMethod,
		EndpointPath:   endpointPath,
		DeletedAt:      deletedAt,
	}
}

func FindingFromModel(item models.Finding) v1dto.FindingDetailDTO {
	var tenantID *string
	if item.TenantID != nil {
		value := item.TenantID.String()
		tenantID = &value
	}
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
		value := item.DeletedAt.Format(timeFormatRFC3339)
		deletedAt = &value
	}
	var slaDueAt *string
	var slaBreached *bool
	var slaBreachedAt *string
	var slaProfile *string
	var slaSource *string
	var slaDaysRemaining *int
	if item.SLADueAt != nil {
		value := item.SLADueAt.Format(timeFormatRFC3339)
		slaDueAt = &value
		slaDaysRemaining = sla.DaysRemaining(item.SLADueAt, time.Now().UTC())
	}
	slaBreached = &item.SLABreached
	if item.SLABreachedAt != nil {
		value := item.SLABreachedAt.Format(timeFormatRFC3339)
		slaBreachedAt = &value
	}
	if item.SLAProfile != nil {
		value := *item.SLAProfile
		slaProfile = &value
	}
	if item.SLASource != nil {
		value := *item.SLASource
		slaSource = &value
	}
	repeatCount := item.RepeatCount
	occurrence := computeOccurrenceStatus(repeatCount, item.DuplicateID)
	firstSeenAt := item.FirstSeenAt.Format(timeFormatRFC3339)
	lastSeenAt := item.LastSeenAt.Format(timeFormatRFC3339)
	return v1dto.FindingDetailDTO{
		FindingListItemDTO: v1dto.FindingListItemDTO{
			ID:               item.ID.String(),
			TenantID:         tenantID,
			Title:            item.Title,
			Severity:         item.Severity,
			Status:           item.Status,
			Category:         item.Category,
			Occurrence:       &occurrence,
			FirstSeenAt:      &firstSeenAt,
			LastSeenAt:       &lastSeenAt,
			RepeatCount:      &repeatCount,
			SLADueAt:         slaDueAt,
			SLABreached:      slaBreached,
			SLABreachedAt:    slaBreachedAt,
			SLAProfile:       slaProfile,
			SLASource:        slaSource,
			SLADaysRemaining: slaDaysRemaining,
			ProductID:        productID,
			AssigneeID:       assigneeID,
			ImportJobID:      importJobID,
			CreatedAt:        item.CreatedAt.Format(timeFormatRFC3339),
			UpdatedAt:        item.UpdatedAt.Format(timeFormatRFC3339),
		},
		Description:    item.Description,
		Fingerprint:    &item.Fingerprint,
		SourceType:     sourceType,
		SourceVersion:  sourceVersion,
		EndpointMethod: endpointMethod,
		EndpointPath:   endpointPath,
		DeletedAt:      deletedAt,
	}
}

func FindingComments(items []storage.FindingCommentItem) []v1dto.FindingComment {
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
			CreatedAt: item.CreatedAt.Format(timeFormatRFC3339),
		})
	}
	return comments
}

func FindingEvents(items []storage.FindingEventItem) []v1dto.FindingEvent {
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
			CreatedAt: item.CreatedAt.Format(timeFormatRFC3339),
		})
	}
	return events
}

func FindingOccurrences(items []storage.FindingOccurrenceItem) []v1dto.FindingOccurrence {
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
			SeenAt:      item.SeenAt.Format(timeFormatRFC3339),
			Status:      item.Status,
			ScannerType: scannerType,
			Snippet:     snippet,
		})
	}
	return response
}

func DuplicateGroup(group *storage.DuplicateGroup) *v1dto.DuplicateGroup {
	if group == nil {
		return nil
	}
	duplicates := make([]v1dto.FindingListItemDTO, 0, len(group.Duplicates))
	for _, item := range group.Duplicates {
		duplicates = append(duplicates, FindingDetail(item).FindingListItemDTO)
	}
	return &v1dto.DuplicateGroup{
		Master:     FindingDetail(group.Master).FindingListItemDTO,
		Duplicates: duplicates,
	}
}

func IntelSummary(summary storage.IntelSummary) *v1dto.IntelSummary {
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
		value := summary.LastRefreshedAt.Format(timeFormatRFC3339)
		resp.LastRefreshedAt = &value
	}
	return resp
}

func IntelDetail(detail *storage.IntelDetail) *v1dto.IntelDetail {
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
		value := detail.UpdatedAt.Format(timeFormatRFC3339)
		resp.UpdatedAt = &value
	}
	return resp
}

func ScaDetail(detail *storage.ScaFindingDetail, evidence map[string]interface{}) *v1dto.ScaDetails {
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

func FindingCategoryDetails(category string, evidence map[string]interface{}, scaDetail *storage.ScaFindingDetail) interface{} {
	switch category {
	case models.CategorySCA:
		if scaDetail == nil {
			return nil
		}
		return &v1dto.FindingDetailsSCA{
			PkgName:          scaDetail.ComponentName,
			InstalledVersion: scaDetail.InstalledVersion,
			FixedVersion:     nullableStringPtr(scaDetail.FixedVersion),
			VulnerabilityID:  scaDetail.VulnerabilityID,
			PrimaryURL:       nullableStringPtr(scaDetail.PrimaryURL),
			Ecosystem:        nullableStringPtr(scaDetail.Ecosystem),
			Purl:             nullableStringPtr(scaDetail.Purl),
			References:       extractStringSlice(evidence, "references"),
			RawSeverity:      nullableStringPtr(scaDetail.RawSeverity),
		}

	case models.CategorySecrets:
		return &v1dto.FindingDetailsSecrets{
			RuleID:   firstStringFromMap(evidence, "ruleId", "ruleID", "check_id"),
			FilePath: firstStringFromMap(evidence, "filePath", "path"),
			Snippet:  firstStringFromMap(evidence, "snippet", "code"),
			Message:  firstStringFromMap(evidence, "message"),
		}

	case models.CategoryConfig:
		return &v1dto.FindingDetailsConfig{
			RuleID:   firstStringFromMap(evidence, "ruleId", "ruleID", "check_id"),
			FilePath: firstStringFromMap(evidence, "filePath", "path"),
			Message:  firstStringFromMap(evidence, "message"),
		}

	case models.CategorySAST:
		// Prefer canonical keys (startLine/endLine/snippet/filePath), fallback to legacy (start.line/end.line/code/path)
		startLine := firstIntFromMap(evidence, "startLine")
		if startLine == nil {
			startLine = nestedIntFromMap(evidence, "start", "line")
		}
		endLine := firstIntFromMap(evidence, "endLine")
		if endLine == nil {
			endLine = nestedIntFromMap(evidence, "end", "line")
		}

		cwe := extractStringSlice(evidence, "cwe")
		owasp := extractStringSlice(evidence, "owasp")

		return &v1dto.FindingDetailsSAST{
			RuleID:    firstStringFromMap(evidence, "ruleId", "ruleID", "check_id"),
			FilePath:  firstStringFromMap(evidence, "filePath", "path"),
			StartLine: startLine,
			EndLine:   endLine,
			Snippet:   firstStringFromMap(evidence, "snippet", "code"),
			Message:   firstStringFromMap(evidence, "message"),
			CWE:       cwe,
			OWASP:     owasp,
		}

	default:
		return nil
	}
}

func LatestImportedEvidence(events []v1dto.FindingEvent) map[string]interface{} {
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

func DecodeEvidencePayload(payload []byte) map[string]interface{} {
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
			if str, ok := item.(string); ok && strings.TrimSpace(str) != "" {
				values = append(values, strings.TrimSpace(str))
			}
		}
		if len(values) > 0 {
			return values
		}
	}
	return nil
}

func firstStringFromMap(data map[string]interface{}, keys ...string) *string {
	if len(data) == 0 {
		return nil
	}
	for _, key := range keys {
		value, ok := data[key]
		if !ok || value == nil {
			continue
		}
		if str, ok := value.(string); ok {
			str = strings.TrimSpace(str)
			if str != "" {
				return &str
			}
		}
	}
	return nil
}

func firstIntFromMap(data map[string]interface{}, keys ...string) *int {
	if len(data) == 0 {
		return nil
	}
	for _, key := range keys {
		value, ok := data[key]
		if !ok || value == nil {
			continue
		}
		if v := intFromAny(value); v != nil {
			return v
		}
	}
	return nil
}

func intFromAny(value interface{}) *int {
	switch typed := value.(type) {
	case int:
		return &typed
	case int32:
		v := int(typed)
		return &v
	case int64:
		v := int(typed)
		return &v
	case float64:
		v := int(typed)
		return &v
	case string:
		s := strings.TrimSpace(typed)
		if s == "" {
			return nil
		}
		if i, err := strconv.Atoi(s); err == nil {
			return &i
		}
		return nil
	default:
		return nil
	}
}

func nestedIntFromMap(data map[string]interface{}, key string, nestedKey string) *int {
	if len(data) == 0 {
		return nil
	}
	raw, ok := data[key]
	if !ok || raw == nil {
		return nil
	}
	child, ok := raw.(map[string]interface{})
	if !ok || child == nil {
		return nil
	}
	return intFromMap(child, nestedKey)
}

func intFromMap(data map[string]interface{}, key string) *int {
	if len(data) == 0 {
		return nil
	}
	value, ok := data[key]
	if !ok || value == nil {
		return nil
	}
	switch typed := value.(type) {
	case int:
		return &typed
	case int32:
		v := int(typed)
		return &v
	case int64:
		v := int(typed)
		return &v
	case float64:
		v := int(typed)
		return &v
	default:
		return nil
	}
}

func nullableStringPtr(value sql.NullString) *string {
	if value.Valid {
		return &value.String
	}
	return nil
}

func computeOccurrenceStatus(repeatCount int, duplicateID *uuid.UUID) string {
	if repeatCount > 0 || duplicateID != nil {
		return "REPEAT"
	}
	return "NEW"
}
