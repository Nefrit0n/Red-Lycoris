package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"red-lycoris/backend/internal/bdu"
	v1 "red-lycoris/backend/internal/dto/v1"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type BDUMatchHandler struct {
	db *sql.DB
}

func NewBDUMatchHandler(db *sql.DB) *BDUMatchHandler {
	return &BDUMatchHandler{db: db}
}

// ListByProduct returns BDU vulnerabilities matched to SBOM components by software name + version.
func (h *BDUMatchHandler) ListByProduct(c *fiber.Ctx) error {
	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	latestSbom, err := storage.GetLatestSbomByProduct(c.Context(), h.db, productID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom"})
	}
	indexedSbom, err := storage.GetLatestIndexedSbomByProduct(c.Context(), h.db, productID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch indexed sbom"})
	}

	datasetStatus, err := h.datasetStatus(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch bdu dataset status"})
	}
	indexStatus := sbomIndexStatusDTO(latestSbom)

	if indexedSbom == nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"data": map[string]interface{}{
				"items":         []v1.BDUMatchDTO{},
				"total":         0,
				"indexStatus":   indexStatus,
				"datasetStatus": datasetStatus,
			},
		})
	}

	search := strings.TrimSpace(c.Query("q"))
	limit := parseIntOrDefault(c.Query("limit"), 50)
	offset := parseIntOrDefault(c.Query("offset"), 0)

	// Phase 1a: SQL name match via bdu_vulnerabilities.software_name
	candidates, err := storage.ListBDUMatchesByName(c.Context(), h.db, indexedSbom.ID, search)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to query bdu matches"})
	}

	// Phase 1b: SQL match via bdu_components table (from "Компоненты" sheet)
	compCandidates, err := storage.ListBDUComponentMatches(c.Context(), h.db, indexedSbom.ID, search)
	if err != nil {
		// Non-fatal: bdu_components table may not exist yet
		log.Printf("[bdu-match] warning: component match query failed: %v", err)
	} else {
		candidates = append(candidates, compCandidates...)
	}

	// Phase 2: Go-level version filtering + dedup by (bdu_id, component_name, component_version)
	seen := make(map[string]struct{})
	matched := make([]v1.BDUMatchDTO, 0)
	for _, m := range candidates {
		constraints := bdu.ParseVersionConstraints(m.SoftwareVersion)
		componentVersion := strings.TrimSpace(m.ComponentVersion)
		softwareVersion := strings.TrimSpace(m.SoftwareVersion)
		// Keep match if version data is absent or cannot be parsed; otherwise enforce constraint match.
		if componentVersion != "" && softwareVersion != "" && len(constraints) > 0 && !bdu.MatchesAny(componentVersion, constraints) {
			continue
		}
		dedupKey := m.BDUID + "|" + m.ComponentName + "|" + m.ComponentVersion
		if _, ok := seen[dedupKey]; ok {
			continue
		}
		seen[dedupKey] = struct{}{}
		matched = append(matched, v1.BDUMatchDTO{
			ComponentName:      m.ComponentName,
			ComponentVersion:   m.ComponentVersion,
			BDUID:              m.BDUID,
			Name:               m.BDUName,
			Description:        m.BDUDescription,
			Severity:           m.Severity,
			CVSSV2:             m.CVSSV2,
			CVSSV3:             m.CVSSV3,
			CVSSV4:             m.CVSSV4,
			SoftwareName:       m.SoftwareName,
			SoftwareVersion:    m.SoftwareVersion,
			SoftwareType:       m.SoftwareType,
			OSHardware:         m.OSHardware,
			ExploitExists:      m.ExploitExists,
			CWEID:              m.CWEID,
			CWEDescription:     m.CWEDescription,
			Status:             m.Status,
			VulnClass:          m.VulnClass,
			Vendor:             m.Vendor,
			Remediation:        m.Remediation,
			FixInfo:            m.FixInfo,
			SourceURLs:         m.SourceURLs,
			OtherIDs:           m.OtherIDs,
			OtherInfo:          m.OtherInfo,
			IncidentInfo:       m.IncidentInfo,
			ExploitationMethod: m.ExploitationMethod,
			FixMethod:          m.FixMethod,
			DetectionDate:      m.DetectionDate,
			PublishedDate:      m.PublishedDate,
			UpdatedDate:        m.UpdatedDate,
			VulnState:          m.VulnState,
		})
	}

	total := len(matched)

	// Apply pagination
	if offset > len(matched) {
		offset = len(matched)
	}
	end := offset + limit
	if end > len(matched) {
		end = len(matched)
	}
	page := matched[offset:end]

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": map[string]interface{}{
			"items":         page,
			"total":         total,
			"indexStatus":   indexStatus,
			"datasetStatus": datasetStatus,
		},
	})
}

func sbomIndexStatusDTO(item *storage.SbomItem) map[string]interface{} {
	if item == nil {
		return map[string]interface{}{
			"status":         "missing",
			"error":          nil,
			"componentCount": 0,
			"edgeCount":      0,
			"indexedAt":      nil,
		}
	}
	return map[string]interface{}{
		"status":         item.IndexStatus,
		"error":          nullString(item.IndexError),
		"componentCount": item.ComponentCount,
		"edgeCount":      item.EdgeCount,
		"indexedAt":      nullTimePtr(item.IndexedAt),
	}
}

func (h *BDUMatchHandler) datasetStatus(ctx context.Context) (map[string]interface{}, error) {
	status, err := storage.GetBDUSyncStatus(ctx, h.db)
	if err != nil {
		return nil, err
	}

	var vulnCount int
	if err := h.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM bdu_vulnerabilities`).Scan(&vulnCount); err != nil {
		return nil, fmt.Errorf("count bdu vulnerabilities: %w", err)
	}
	var componentCount int
	if err := h.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM bdu_components`).Scan(&componentCount); err != nil {
		return nil, fmt.Errorf("count bdu components: %w", err)
	}

	var syncedAt *time.Time
	if status != nil && status.LastSyncedAt != nil {
		t := status.LastSyncedAt.UTC()
		syncedAt = &t
	}
	lastError := ""
	isSyncing := false
	if status != nil {
		lastError = status.LastError
		isSyncing = status.IsSyncing
	}
	return map[string]interface{}{
		"isLoaded":           vulnCount > 0,
		"isSyncing":          isSyncing,
		"lastError":          lastError,
		"syncedAt":           syncedAt,
		"vulnerabilityCount": vulnCount,
		"componentCount":     componentCount,
	}, nil
}
