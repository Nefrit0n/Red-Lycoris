// Package importing provides a unified service for importing security findings
// with deduplication logic. This eliminates code duplication between scan_upload
// handler and analysis_worker.
package importing

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"red-lycoris/backend/internal/dedup"
	"red-lycoris/backend/internal/importing/plugins"
	"red-lycoris/backend/internal/intel"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/parser"
	"red-lycoris/backend/internal/policies"
	"red-lycoris/backend/internal/sla"
	"red-lycoris/backend/internal/storage"

	"github.com/google/uuid"
)

// ImportResult contains the results of a finding import operation
type ImportResult struct {
	ImportJobID uuid.UUID
	ScanID      uuid.UUID
	Total       int
	New         int
	Duplicates  int
}

// ImportParams contains parameters for importing findings
type ImportParams struct {
	Scanner       string
	Report        []byte
	SourceType    string
	SourceVersion *string
	ProductID     *uuid.UUID
	EngagementID  *uuid.UUID
	CreatedBy     *uuid.UUID
	TenantID      *uuid.UUID
	Callbacks     *ImportCallbacks
	PolicyEngine  policies.Evaluator
	PolicyActorID *uuid.UUID
	CorrelationID *string
	SLAMatrix     sla.Matrix
}

// ImportCallbacks contains optional callback functions for import events
type ImportCallbacks struct {
	// OnFindingCreated is called when a new finding is created
	OnFindingCreated func(finding *models.Finding)
	// OnDuplicateCreated is called when a duplicate finding is created
	OnDuplicateCreated func(finding *models.Finding, masterID uuid.UUID)
	// OnIdentifiersDetected is called when vulnerability identifiers are detected
	OnIdentifiersDetected func(identifiers []string)
	// OnImportStarted is called when import job starts
	OnImportStarted func(jobID uuid.UUID)
	// OnImportFailed is called when import job fails
	OnImportFailed func(jobID uuid.UUID, err error)
	// OnImportSucceeded is called when import job succeeds
	OnImportSucceeded func(jobID uuid.UUID, total, new, duplicates int)
	// OnPolicyGateFailed is called when a policy gate marks import job or scan result failed
	OnPolicyGateFailed func(subjectType string, subjectID uuid.UUID, decision policies.Decision, inputHash string)
}

// ImportFindings parses a security scan report and imports findings with deduplication.
// This is the unified implementation used by both scan_upload handler and analysis_worker.
func ImportFindings(ctx context.Context, db *sql.DB, params ImportParams) (*ImportResult, error) {
	checksum := ComputeChecksum(params.Report)
	sourceType := normalizeSourceType(params.SourceType)

	importJob := &models.ImportJob{
		Scanner:       params.Scanner,
		SourceType:    &sourceType,
		SourceVersion: params.SourceVersion,
		Status:        models.ImportJobQueued,
		Checksum:      checksum,
		CreatedBy:     params.CreatedBy,
		TenantID:      params.TenantID,
	}
	if params.ProductID != nil {
		importJob.ProductID = params.ProductID
	}
	if err := storage.CreateImportJob(ctx, db, importJob); err != nil {
		return nil, err
	}

	startedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobRunning, &startedAt, nil, nil); err != nil {
		return nil, err
	}
	if params.Callbacks != nil && params.Callbacks.OnImportStarted != nil {
		params.Callbacks.OnImportStarted(importJob.ID)
	}

	if len(params.Report) == 0 {
		finishedAt := time.Now().UTC()
		errMsg := "report is required"
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		if params.Callbacks != nil && params.Callbacks.OnImportFailed != nil {
			params.Callbacks.OnImportFailed(importJob.ID, errors.New(errMsg))
		}
		return nil, errors.New(errMsg)
	}

	plugin, reportVersion, err := plugins.DefaultRegistry().GetBestMatch(params.Scanner, params.Report)
	if err != nil {
		finishedAt := time.Now().UTC()
		errMsg := err.Error()
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		if params.Callbacks != nil && params.Callbacks.OnImportFailed != nil {
			params.Callbacks.OnImportFailed(importJob.ID, err)
		}
		return nil, err
	}

	parsedFindings, err := plugin.Parse(params.Report)
	if err != nil {
		finishedAt := time.Now().UTC()
		errMsg := err.Error()
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		if params.Callbacks != nil && params.Callbacks.OnImportFailed != nil {
			params.Callbacks.OnImportFailed(importJob.ID, err)
		}
		return nil, err
	}

	if reportVersion == "" {
		reportVersion = "unknown"
	}

	canonicalFindings, err := plugin.Normalize(parsedFindings, reportVersion)
	if err != nil {
		finishedAt := time.Now().UTC()
		errMsg := err.Error()
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		if params.Callbacks != nil && params.Callbacks.OnImportFailed != nil {
			params.Callbacks.OnImportFailed(importJob.ID, err)
		}
		return nil, err
	}

	if len(canonicalFindings) == 0 && json.Valid(params.Report) && !strings.EqualFold(params.Scanner, "semgrep") {
		finishedAt := time.Now().UTC()
		errMsg := "report contains no findings"
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		if params.Callbacks != nil && params.Callbacks.OnImportFailed != nil {
			params.Callbacks.OnImportFailed(importJob.ID, errors.New(errMsg))
		}
		return nil, errors.New(errMsg)
	}

	findings := make([]parser.Finding, 0, len(canonicalFindings))
	for _, finding := range canonicalFindings {
		findings = append(findings, canonicalToFinding(finding))
	}

	scan := &models.ScanResult{
		TenantID:      params.TenantID,
		EngagementID:  params.EngagementID,
		ProductID:     params.ProductID,
		UploaderID:    params.CreatedBy,
		ImportJobID:   &importJob.ID,
		Scanner:       params.Scanner,
		SourceType:    &sourceType,
		SourceVersion: params.SourceVersion,
		RawReport:     params.Report,
	}
	if err := storage.CreateScanResult(ctx, db, scan); err != nil {
		finishedAt := time.Now().UTC()
		errMsg := "failed to store scan result"
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		return nil, err
	}

	duplicates := 0
	createdFindings := 0
	seenAt := time.Now().UTC()
	identifierSet := map[string]struct{}{}
	slaMatrix := resolveSLAMatrix(params)

	for i, finding := range findings {
		canonical := canonicalFindings[i]
		result, err := processFinding(ctx, db, processFindingParams{
			finding:       finding,
			scanner:       params.Scanner,
			sourceType:    &sourceType,
			sourceVersion: params.SourceVersion,
			productID:     params.ProductID,
			tenantID:      params.TenantID,
			scanID:        scan.ID,
			importJobID:   importJob.ID,
			seenAt:        seenAt,
			slaMatrix:     slaMatrix,
		})
		if err != nil {
			return nil, err
		}
		if result.isNew {
			createdFindings++
			if params.Callbacks != nil && params.Callbacks.OnFindingCreated != nil {
				params.Callbacks.OnFindingCreated(result.finding)
			}
		} else {
			duplicates++
			if params.Callbacks != nil && params.Callbacks.OnDuplicateCreated != nil {
				params.Callbacks.OnDuplicateCreated(result.finding, result.masterID)
			}
		}

		if params.PolicyEngine != nil {
			if err := applyFindingPolicies(ctx, db, policyFindingParams{
				DecisionEngine: params.PolicyEngine,
				Finding:        result.finding,
				ParserFinding:  finding,
				Scanner:        params.Scanner,
				SourceType:     &sourceType,
				SourceVersion:  params.SourceVersion,
				ProductID:      params.ProductID,
				ImportJobID:    &importJob.ID,
				ActorID:        params.PolicyActorID,
				CorrelationID:  params.CorrelationID,
			}); err != nil {
				return nil, err
			}
		}

		if len(finding.Evidence) > 0 {
			targetID := result.finding.ID
			if !result.isNew {
				targetID = result.masterID
			}
			if err := createFindingImportEvent(ctx, db, targetID, finding.Evidence); err != nil {
				return nil, err
			}
		}

		identifiers := mergeIdentifiers(canonical.Identifiers, intel.ExtractIdentifiersFromFinding(finding))
		if len(identifiers) > 0 {
			targetID := result.finding.ID
			if !result.isNew {
				targetID = result.masterID
			}
			if err := storage.UpsertFindingIdentifiers(ctx, db, targetID, identifiers); err != nil {
				return nil, err
			}
			for _, identifier := range identifiers {
				identifierSet[identifier] = struct{}{}
			}
		}
	}

	if params.ProductID != nil {
		_ = storage.UpdateImportJobProductID(ctx, db, importJob.ID, *params.ProductID)
	}

	if err := storage.UpdateImportJobStats(ctx, db, importJob.ID, len(findings), createdFindings, duplicates); err != nil {
		return nil, err
	}
	importJob.FindingsTotal = len(findings)
	importJob.FindingsNew = createdFindings
	importJob.DuplicatesTotal = duplicates

	if params.PolicyEngine != nil {
		if err := applyImportAggregatePolicies(ctx, db, policyAggregateParams{
			DecisionEngine: params.PolicyEngine,
			ImportJob:      importJob,
			ScanResult:     scan,
			Findings:       findings,
			ProductID:      params.ProductID,
			ActorID:        params.PolicyActorID,
			CorrelationID:  params.CorrelationID,
			Callbacks:      params.Callbacks,
		}); err != nil {
			return nil, err
		}
	}

	if params.Callbacks != nil && params.Callbacks.OnIdentifiersDetected != nil && len(identifierSet) > 0 {
		identifiers := make([]string, 0, len(identifierSet))
		for identifier := range identifierSet {
			identifiers = append(identifiers, identifier)
		}
		params.Callbacks.OnIdentifiersDetected(identifiers)
	}

	finishedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobSucceeded, nil, &finishedAt, nil); err != nil {
		return nil, err
	}
	if params.Callbacks != nil && params.Callbacks.OnImportSucceeded != nil {
		params.Callbacks.OnImportSucceeded(importJob.ID, len(findings), createdFindings, duplicates)
	}

	return &ImportResult{
		ImportJobID: importJob.ID,
		ScanID:      scan.ID,
		Total:       len(canonicalFindings),
		New:         createdFindings,
		Duplicates:  duplicates,
	}, nil
}

type processFindingParams struct {
	finding       parser.Finding
	scanner       string
	sourceType    *string
	sourceVersion *string
	productID     *uuid.UUID
	tenantID      *uuid.UUID
	scanID        uuid.UUID
	importJobID   uuid.UUID
	seenAt        time.Time
	slaMatrix     sla.Matrix
}

type processFindingResult struct {
	isNew    bool
	finding  *models.Finding
	masterID uuid.UUID
}

// processFinding handles a single finding with deduplication logic.
// Returns result with finding details and whether it's new or duplicate.
func processFinding(ctx context.Context, db *sql.DB, params processFindingParams) (*processFindingResult, error) {
	fingerprint := dedup.ComputeFingerprint(params.scanner, params.finding)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}

	masterRecord, found, err := findExistingMaster(ctx, tx, fingerprint, params.productID, params.tenantID)
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if !found {
		// Create new finding
		evidence, err := marshalJSONMap(params.finding.Evidence)
		if err != nil {
			_ = tx.Rollback()
			return nil, err
		}
		rawData, err := marshalJSONMap(params.finding.RawData)
		if err != nil {
			_ = tx.Rollback()
			return nil, err
		}
		cwe, owasp := extractEvidenceTags(params.finding.Evidence)
		model := &models.Finding{
			TenantID:      params.tenantID,
			ScanResultID:  &params.scanID,
			ProductID:     params.productID,
			Fingerprint:   fingerprint,
			Category:      resolveFindingCategory(params.finding),
			Title:         params.finding.Title,
			Description:   params.finding.Description,
			Severity:      params.finding.Severity,
			Status:        models.StatusNew,
			ImportJobID:   &params.importJobID,
			FirstSeenAt:   params.seenAt,
			LastSeenAt:    params.seenAt,
			RepeatCount:   0,
			SourceType:    params.sourceType,
			SourceVersion: params.sourceVersion,
			Evidence:      evidence,
			CWE:           cwe,
			OWASP:         owasp,
			RawData:       rawData,
		}
		if dueAt, ok := sla.DueAt(params.seenAt, params.finding.Severity, params.slaMatrix); ok {
			model.SLADueAt = &dueAt
			model.SLABreached = false
			profile := sla.DefaultProfile
			source := sla.DefaultSource
			model.SLAProfile = &profile
			model.SLASource = &source
		}
		if err := storage.CreateFindingTx(ctx, tx, model); err != nil {
			_ = tx.Rollback()
			return nil, err
		}
		if err := createScaRecordIfNeeded(ctx, tx, model.ID, params.finding); err != nil {
			_ = tx.Rollback()
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return &processFindingResult{isNew: true, finding: model}, nil
	}

	// Create duplicate finding
	evidence, err := marshalJSONMap(params.finding.Evidence)
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	rawData, err := marshalJSONMap(params.finding.RawData)
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	cwe, owasp := extractEvidenceTags(params.finding.Evidence)
	duplicate := &models.Finding{
		TenantID:      params.tenantID,
		ScanResultID:  &params.scanID,
		ProductID:     params.productID,
		Fingerprint:   fingerprint,
		Category:      resolveFindingCategory(params.finding),
		Title:         params.finding.Title,
		Description:   params.finding.Description,
		Severity:      params.finding.Severity,
		Status:        models.StatusDuplicate,
		DuplicateID:   &masterRecord.ID,
		ImportJobID:   &params.importJobID,
		FirstSeenAt:   params.seenAt,
		LastSeenAt:    params.seenAt,
		RepeatCount:   0,
		SourceType:    params.sourceType,
		SourceVersion: params.sourceVersion,
		Evidence:      evidence,
		CWE:           cwe,
		OWASP:         owasp,
		RawData:       rawData,
	}
	if err := storage.CreateFindingTx(ctx, tx, duplicate); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if err := createScaRecordIfNeeded(ctx, tx, duplicate.ID, params.finding); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	// Update master's repeat count, last_seen_at, and SLA if needed.
	updateArgs := []interface{}{masterRecord.RepeatCount + 1, params.seenAt}
	setClauses := []string{
		"repeat_count = $1",
		"last_seen_at = $2",
		"updated_at = $2",
	}
	incomingSeverity := params.finding.Severity
	effectiveSeverity := masterRecord.Severity
	if sla.SeverityRank(incomingSeverity) > sla.SeverityRank(masterRecord.Severity) {
		updateArgs = append(updateArgs, incomingSeverity)
		setClauses = append(setClauses, fmt.Sprintf("severity = $%d", len(updateArgs)))
		effectiveSeverity = incomingSeverity
	}
	if dueAt, ok := sla.DueAt(masterRecord.FirstSeenAt, effectiveSeverity, params.slaMatrix); ok {
		existingDueAt := nullableTime(masterRecord.SLADueAt)
		if sla.ShouldUpdateDueAt(existingDueAt, dueAt) {
			updateArgs = append(updateArgs, dueAt)
			setClauses = append(setClauses, fmt.Sprintf("sla_due_at = $%d", len(updateArgs)))
			profile := sla.DefaultProfile
			source := sla.DefaultSource
			updateArgs = append(updateArgs, profile, source)
			setClauses = append(setClauses, fmt.Sprintf("sla_profile = $%d", len(updateArgs)-1))
			setClauses = append(setClauses, fmt.Sprintf("sla_source = $%d", len(updateArgs)))
		}
	}
	updateArgs = append(updateArgs, masterRecord.ID)
	var queryBuilder strings.Builder
	queryBuilder.WriteString(`
		UPDATE findings
		SET `)
	queryBuilder.WriteString(strings.Join(setClauses, ", "))
	queryBuilder.WriteString(`
		WHERE id = $`)
	queryBuilder.WriteString(strconv.Itoa(len(updateArgs)))
	query := queryBuilder.String()
	if _, err := tx.ExecContext(ctx, query, updateArgs...); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &processFindingResult{isNew: false, finding: duplicate, masterID: masterRecord.ID}, nil
}

func resolveFindingCategory(finding parser.Finding) string {
	if finding.Category != "" {
		return finding.Category
	}
	return models.CategorySAST
}

func canonicalToFinding(finding plugins.CanonicalFinding) parser.Finding {
	category := strings.TrimSpace(finding.Category)
	if category == "" {
		category = strings.TrimSpace(finding.Kind)
	}
	rawData := finding.RawData
	if rawData == nil {
		rawData = map[string]any{}
	}
	return parser.Finding{
		Category:    category,
		Title:       finding.Title,
		Description: finding.Description,
		Severity:    finding.Severity,
		Location:    finding.Location,
		RuleID:      finding.RuleID,
		RawData:     rawData,
		Evidence:    finding.Evidence,
	}
}

func mergeIdentifiers(primary []string, additional []string) []string {
	if len(primary) == 0 && len(additional) == 0 {
		return nil
	}
	set := map[string]struct{}{}
	merged := make([]string, 0, len(primary)+len(additional))
	for _, identifier := range append(primary, additional...) {
		normalized := strings.TrimSpace(identifier)
		if normalized == "" {
			continue
		}
		if _, ok := set[normalized]; ok {
			continue
		}
		set[normalized] = struct{}{}
		merged = append(merged, normalized)
	}
	return merged
}

type scaExtraction struct {
	ComponentName    string
	Ecosystem        *string
	Purl             *string
	InstalledVersion string
	FixedVersion     *string
	VulnerabilityID  string
	PrimaryURL       *string
	RawSeverity      *string
}

func createScaRecordIfNeeded(ctx context.Context, tx *sql.Tx, findingID uuid.UUID, finding parser.Finding) error {
	extracted := extractScaDetails(finding)
	if extracted == nil {
		return nil
	}
	componentID, err := storage.UpsertScaComponentTx(ctx, tx, extracted.ComponentName, extracted.Ecosystem, extracted.Purl)
	if err != nil {
		return err
	}
	detail := storage.ScaFindingDetail{
		FindingID:        findingID,
		ComponentID:      componentID,
		InstalledVersion: extracted.InstalledVersion,
		VulnerabilityID:  extracted.VulnerabilityID,
		FixedVersion:     toNullString(extracted.FixedVersion),
		PrimaryURL:       toNullString(extracted.PrimaryURL),
		RawSeverity:      toNullString(extracted.RawSeverity),
	}
	return storage.CreateScaFindingTx(ctx, tx, detail)
}

func extractScaDetails(finding parser.Finding) *scaExtraction {
	if !strings.EqualFold(finding.Category, models.CategorySCA) {
		return nil
	}
	component := firstNonEmptyString(
		extractString(finding.Evidence, "pkgName"),
		extractString(finding.Evidence, "package"),
		extractString(finding.RawData, "package"),
	)
	installedVersion := firstNonEmptyString(
		extractString(finding.Evidence, "installedVersion"),
		extractString(finding.Evidence, "installed_version"),
		extractString(finding.RawData, "installed_version"),
	)
	vulnerabilityID := firstNonEmptyString(
		extractString(finding.Evidence, "vulnerabilityId"),
		extractString(finding.Evidence, "vulnerability_id"),
		finding.RuleID,
	)
	if component == "" || installedVersion == "" || vulnerabilityID == "" {
		return nil
	}
	ecosystem := extractOptionalString(finding.Evidence, "ecosystem")
	purl := extractOptionalString(finding.Evidence, "purl")
	fixedVersion := extractOptionalString(finding.Evidence, "fixedVersion")
	primaryURL := extractOptionalString(finding.Evidence, "primaryUrl")
	rawSeverity := extractOptionalString(finding.Evidence, "severity")

	return &scaExtraction{
		ComponentName:    component,
		Ecosystem:        ecosystem,
		Purl:             purl,
		InstalledVersion: installedVersion,
		FixedVersion:     fixedVersion,
		VulnerabilityID:  vulnerabilityID,
		PrimaryURL:       primaryURL,
		RawSeverity:      rawSeverity,
	}
}

func extractString(data map[string]any, key string) string {
	if data == nil {
		return ""
	}
	if value, ok := data[key]; ok {
		if str, ok := value.(string); ok {
			return strings.TrimSpace(str)
		}
	}
	return ""
}

func extractOptionalString(data map[string]any, key string) *string {
	value := extractString(data, key)
	if value == "" {
		return nil
	}
	return &value
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func toNullString(value *string) sql.NullString {
	if value == nil || strings.TrimSpace(*value) == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: strings.TrimSpace(*value), Valid: true}
}

func resolveSLAMatrix(params ImportParams) sla.Matrix {
	if params.SLAMatrix == (sla.Matrix{}) {
		return sla.DefaultMatrix()
	}
	return params.SLAMatrix
}

func nullableTime(value sql.NullTime) *time.Time {
	if value.Valid {
		clone := value.Time
		return &clone
	}
	return nil
}

// findExistingMaster looks for an existing master finding with the same fingerprint.
// Returns the master ID, repeat count, whether found, and any error.
type existingMaster struct {
	ID          uuid.UUID
	RepeatCount int
	Severity    string
	FirstSeenAt time.Time
	SLADueAt    sql.NullTime
}

func findExistingMaster(ctx context.Context, tx *sql.Tx, fingerprint string, productID *uuid.UUID, tenantID *uuid.UUID) (*existingMaster, bool, error) {
	query := `SELECT id, repeat_count, severity, first_seen_at, sla_due_at
		 FROM findings
		 WHERE fingerprint = $1
		   AND duplicate_id IS NULL
		   AND deleted_at IS NULL`
	args := []interface{}{fingerprint}

	if tenantID != nil {
		query += " AND tenant_id = $2"
		args = append(args, *tenantID)
	}

	if productID != nil {
		query += fmt.Sprintf(" AND product_id = $%d", len(args)+1)
		args = append(args, *productID)
	} else {
		query += " AND product_id IS NULL"
	}
	query += " LIMIT 1 FOR UPDATE"

	var record existingMaster
	err := tx.QueryRowContext(ctx, query, args...).Scan(
		&record.ID,
		&record.RepeatCount,
		&record.Severity,
		&record.FirstSeenAt,
		&record.SLADueAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, false, nil
		}
		return nil, false, err
	}
	return &record, true, nil
}

// ComputeChecksum calculates SHA256 checksum of data
func ComputeChecksum(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func normalizeSourceType(value string) string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return "scanner"
	}
	return strings.ToLower(normalized)
}

func extractEvidenceTags(evidence map[string]any) ([]string, []string) {
	if len(evidence) == 0 {
		return nil, nil
	}
	return extractEvidenceStringSlice(evidence, "cwe"), extractEvidenceStringSlice(evidence, "owasp")
}

func extractEvidenceStringSlice(evidence map[string]any, key string) []string {
	raw, ok := evidence[key]
	if !ok || raw == nil {
		return nil
	}
	switch value := raw.(type) {
	case []string:
		return compactStrings(value)
	case []any:
		out := make([]string, 0, len(value))
		for _, entry := range value {
			if str, ok := entry.(string); ok && strings.TrimSpace(str) != "" {
				out = append(out, str)
			}
		}
		return out
	case string:
		if strings.TrimSpace(value) == "" {
			return nil
		}
		return []string{value}
	default:
		return nil
	}
}

func compactStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			out = append(out, value)
		}
	}
	return out
}

func marshalJSONMap(value map[string]any) (json.RawMessage, error) {
	if len(value) == 0 {
		return nil, nil
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

// NullUUIDPtr converts uuid.NullUUID to *uuid.UUID
func NullUUIDPtr(value uuid.NullUUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	return &value.UUID
}

func createFindingImportEvent(ctx context.Context, db *sql.DB, findingID uuid.UUID, evidence map[string]any) error {
	if len(evidence) == 0 {
		return nil
	}
	payload, err := json.Marshal(evidence)
	if err != nil {
		return err
	}
	event := &models.FindingEvent{
		FindingID: findingID,
		EventType: "finding.imported",
		Payload:   payload,
	}
	return storage.CreateFindingEvent(ctx, db, event)
}
