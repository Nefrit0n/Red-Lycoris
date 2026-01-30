package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

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

// GET /api/v1/sbom/:id/transitive?maxDepth=25&q=&limit=200&offset=0
func (h *SbomTransitiveHandler) ListVulnerable(c *fiber.Ctx) error {
	sbomID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid sbom id"})
	}

	maxDepth := parseIntOrDefault(strings.TrimSpace(c.Query("maxDepth")), 25)
	limit := parseIntOrDefault(strings.TrimSpace(c.Query("limit")), 200)
	offset := parseIntOrDefault(strings.TrimSpace(c.Query("offset")), 0)
	query := strings.TrimSpace(c.Query("q"))

	if limit < 1 || limit > 1000 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid limit/offset"})
	}
	if maxDepth != 10 && maxDepth != 25 && maxDepth != 50 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid maxDepth"})
	}

	status, err := storage.GetSbomTransitiveStatus(c.Context(), h.db, sbomID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom status"})
	}
	if status == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "sbom not found"})
	}

	items, total, err := storage.ListSbomTransitiveExposure(c.Context(), h.db, storage.SbomTransitiveExposureFilters{
		SbomID:   sbomID,
		MaxDepth: maxDepth,
		Query:    query,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch transitive exposure"})
	}

	respItems := make([]dtov1.SbomTransitiveExposureDTO, 0, len(items))
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
		var minDistance *int
		if it.MinDistanceToAnyVuln.Valid {
			v := int(it.MinDistanceToAnyVuln.Int64)
			minDistance = &v
		}

		respItems = append(respItems, dtov1.SbomTransitiveExposureDTO{
			ID:                   it.ComponentID.String(),
			Purl:                 purl,
			Name:                 it.Name,
			Version:              ver,
			Ecosystem:            eco,
			CriticalCount:        it.CriticalCount,
			HighCount:            it.HighCount,
			MediumCount:          it.MediumCount,
			LowCount:             it.LowCount,
			MaxCvssScore:         it.MaxCvss,
			MaxEpssScore:         it.MaxEpss,
			MinDistanceToAnyVuln: minDistance,
		})
	}

	var updatedAt *time.Time
	if status.UpdatedAt.Valid {
		t := status.UpdatedAt.Time
		updatedAt = &t
	}
	var transitiveError *string
	if status.Error.Valid {
		msg := status.Error.String
		transitiveError = &msg
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"status": dtov1.SbomTransitiveStatusDTO{
			Status:    status.Status,
			Error:     transitiveError,
			UpdatedAt: updatedAt,
		},
		"data": fiber.Map{
			"items":    respItems,
			"total":    total,
			"maxDepth": maxDepth,
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
