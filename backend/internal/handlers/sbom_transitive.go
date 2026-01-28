package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	dtov1 "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type SbomTransitiveHandler struct {
	db *sql.DB
}

func NewSbomTransitiveHandler(db *sql.DB) *SbomTransitiveHandler {
	return &SbomTransitiveHandler{db: db}
}

// GET /api/v1/sbom/:id/transitive?rootComponentId=<uuid>&maxDepth=25&limit=50&offset=0
func (h *SbomTransitiveHandler) ListVulnerable(c *fiber.Ctx) error {
	sbomID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid sbom id"})
	}

	rootRaw := strings.TrimSpace(c.Query("rootComponentId"))
	if rootRaw == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "rootComponentId is required"})
	}
	rootID, err := uuid.Parse(rootRaw)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid rootComponentId"})
	}

	maxDepth := parseIntOrDefault(strings.TrimSpace(c.Query("maxDepth")), 25)
	limit := parseIntOrDefault(strings.TrimSpace(c.Query("limit")), 50)
	offset := parseIntOrDefault(strings.TrimSpace(c.Query("offset")), 0)

	if limit < 1 || limit > 1000 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid limit/offset"})
	}
	if maxDepth < 1 || maxDepth > 100 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid maxDepth"})
	}

	items, total, err := storage.ListSbomTransitiveVulnerableComponents(c.Context(), h.db, storage.SbomTransitiveFilters{
		SbomID:          sbomID,
		RootComponentID: rootID,
		MaxDepth:        maxDepth,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to compute transitive dependencies"})
	}

	respItems := make([]dtov1.SbomTransitiveComponentDTO, 0, len(items))
	for _, it := range items {
		var purl *string
		if it.Purl.Valid {
			v := it.Purl.String
			purl = &v
		}
		var ver *string
		if it.Version.Valid {
			v := it.Version.String
			ver = &v
		}
		var eco *string
		if it.Ecosystem.Valid {
			v := it.Ecosystem.String
			eco = &v
		}

		respItems = append(respItems, dtov1.SbomTransitiveComponentDTO{
			ID:           it.ID.String(),
			Purl:         purl,
			Name:         it.Name,
			Version:      ver,
			Ecosystem:    eco,
			MinDepth:     it.MinDepth,
			VulnTotal:    it.VulnTotal,
			VulnCritical: it.VulnCritical,
			VulnHigh:     it.VulnHigh,
			VulnMedium:   it.VulnMedium,
			VulnLow:      it.VulnLow,
			MaxCvssScore: it.MaxCvssScore,
			MaxEpssScore: it.MaxEpssScore,
			KEV:          it.KEV,
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"sbomId":          sbomID.String(),
			"rootComponentId": rootID.String(),
			"maxDepth":        maxDepth,
			"items":           respItems,
			"total":           total,
		},
	})
}

// GET /api/v1/sbom/:id/path?fromComponentId=<uuid>&toComponentId=<uuid>&maxDepth=25
func (h *SbomTransitiveHandler) Path(c *fiber.Ctx) error {
	sbomID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid sbom id"})
	}

	fromRaw := strings.TrimSpace(c.Query("fromComponentId"))
	toRaw := strings.TrimSpace(c.Query("toComponentId"))
	if fromRaw == "" || toRaw == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "fromComponentId and toComponentId are required"})
	}
	fromID, err := uuid.Parse(fromRaw)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid fromComponentId"})
	}
	toID, err := uuid.Parse(toRaw)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid toComponentId"})
	}

	maxDepth := parseIntOrDefault(strings.TrimSpace(c.Query("maxDepth")), 25)
	if maxDepth < 1 || maxDepth > 100 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid maxDepth"})
	}

	nodes, depth, err := storage.FindSbomShortestPath(c.Context(), h.db, sbomID, fromID, toID, maxDepth)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to compute dependency path"})
	}
	if len(nodes) == 0 {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "path not found"})
	}

	resp := make([]dtov1.SbomPathNodeDTO, 0, len(nodes))
	for _, it := range nodes {
		var purl *string
		if it.Purl.Valid {
			v := it.Purl.String
			purl = &v
		}
		var ver *string
		if it.Version.Valid {
			v := it.Version.String
			ver = &v
		}
		var eco *string
		if it.Ecosystem.Valid {
			v := it.Ecosystem.String
			eco = &v
		}

		resp = append(resp, dtov1.SbomPathNodeDTO{
			ID:        it.ID.String(),
			Purl:      purl,
			Name:      it.Name,
			Version:   ver,
			Ecosystem: eco,
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": dtov1.SbomPathDTO{
			Depth: depth,
			Nodes: resp,
		},
	})
}
