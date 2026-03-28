package handlers

import (
	"database/sql"
	"strings"

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

	indexedSbom, err := storage.GetLatestIndexedSbomByProduct(c.Context(), h.db, productID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom"})
	}
	if indexedSbom == nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"data": map[string]interface{}{
				"items": []v1.BDUMatchDTO{},
				"total": 0,
			},
		})
	}

	search := strings.TrimSpace(c.Query("q"))
	limit := parseIntOrDefault(c.Query("limit"), 50)
	offset := parseIntOrDefault(c.Query("offset"), 0)

	// Phase 1: SQL name match
	candidates, err := storage.ListBDUMatchesByName(c.Context(), h.db, indexedSbom.ID, search)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to query bdu matches"})
	}

	// Phase 2: Go-level version filtering
	matched := make([]v1.BDUMatchDTO, 0)
	for _, m := range candidates {
		constraints := bdu.ParseVersionConstraints(m.SoftwareVersion)
		if !bdu.MatchesAny(m.ComponentVersion, constraints) {
			continue
		}
		matched = append(matched, v1.BDUMatchDTO{
			ComponentName:      m.ComponentName,
			ComponentVersion:   m.ComponentVersion,
			PackageName:        m.ComponentName,
			PackageVersion:     m.ComponentVersion,
			BDUID:              m.BDUID,
			Identifier:         m.BDUID,
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
			VulnState:          m.VulnState,
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
			Consequences:       m.Consequences,
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
			"items": page,
			"total": total,
		},
	})
}
