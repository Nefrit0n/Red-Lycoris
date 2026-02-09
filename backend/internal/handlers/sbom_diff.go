package handlers

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// DiffByVersion returns component-level diff between two SBOM versions for a product.
// GET /api/v1/sbom/diff?productId=...&fromVersion=1&toVersion=2&kind=changed&limit=100&offset=0
func (h *SbomHandler) DiffByVersion(c *fiber.Ctx) error {
	productIDRaw := strings.TrimSpace(c.Query("productId"))
	if productIDRaw == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "productId is required"})
	}
	productID, err := uuid.Parse(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid productId"})
	}

	fromV, err := parsePositiveInt(c.Query("fromVersion"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid fromVersion"})
	}
	toV, err := parsePositiveInt(c.Query("toVersion"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid toVersion"})
	}
	if fromV == 0 || toV == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "fromVersion and toVersion are required"})
	}

	fromID, err := storage.GetSbomIDByProductVersion(c.Context(), h.db, productID, fromV)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to resolve fromVersion"})
	}
	toID, err := storage.GetSbomIDByProductVersion(c.Context(), h.db, productID, toV)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to resolve toVersion"})
	}
	if fromID == nil || toID == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "sbom version not found"})
	}

	fromSbom, err := storage.GetSbomByID(c.Context(), h.db, *fromID)
	if err != nil || fromSbom == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "from sbom not found"})
	}
	toSbom, err := storage.GetSbomByID(c.Context(), h.db, *toID)
	if err != nil || toSbom == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "to sbom not found"})
	}

	// Require indexed SBOMs, otherwise diff is meaningless.
	if strings.ToLower(strings.TrimSpace(fromSbom.IndexStatus)) != "done" ||
		strings.ToLower(strings.TrimSpace(toSbom.IndexStatus)) != "done" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"error":   "sbom is not indexed yet",
			"data": fiber.Map{
				"from": fiber.Map{"id": fromSbom.ID.String(), "version": fromV, "indexStatus": fromSbom.IndexStatus},
				"to":   fiber.Map{"id": toSbom.ID.String(), "version": toV, "indexStatus": toSbom.IndexStatus},
			},
		})
	}

	kind := storage.SbomDiffKind(c.Query("kind"))
	limit, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))
	offset, _ := strconv.Atoi(strings.TrimSpace(c.Query("offset")))
	limit = clampInt(limit, 1, 1000, 100)
	offset = maxInt(offset, 0)

	items, total, summary, err := storage.DiffSbomComponents(c.Context(), h.db, storage.SbomDiffFilters{
		FromSbomID: *fromID,
		ToSbomID:   *toID,
		Kind:       kind,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		rid := getRequestID(c)
		fmt.Printf("sbom diff failed request_id=%s product_id=%s from_v=%d to_v=%d err=%v\n", rid, productID.String(), fromV, toV, err)

		resp := fiber.Map{"success": false, "error": "failed to compute sbom diff"}
		if rid != "" {
			resp["requestId"] = rid
		}
		if debugErrorsEnabled() {
			resp["details"] = err.Error()
		}
		return c.Status(fiber.StatusInternalServerError).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"productId": productID.String(),
			"from": fiber.Map{
				"id":               fromSbom.ID.String(),
				"version":          fromV,
				"createdAt":        nullTime(fromSbom.CreatedAt),
				"sha256":           fromSbom.SHA256,
				"format":           fromSbom.Format,
				"originalFilename": fromSbom.OriginalFilename,
				"indexStatus":      fromSbom.IndexStatus,
			},
			"to": fiber.Map{
				"id":               toSbom.ID.String(),
				"version":          toV,
				"createdAt":        nullTime(toSbom.CreatedAt),
				"sha256":           toSbom.SHA256,
				"format":           toSbom.Format,
				"originalFilename": toSbom.OriginalFilename,
				"indexStatus":      toSbom.IndexStatus,
			},
			"summary":     summary,
			"total":       total,
			"items":       mapSbomDiffItems(items),
			"limit":       limit,
			"offset":      offset,
			"generatedAt": time.Now().UTC().Format(time.RFC3339),
		},
	})
}

func parsePositiveInt(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0, err
	}
	if v < 0 {
		return 0, fmt.Errorf("negative")
	}
	return v, nil
}

func mapSbomDiffItems(items []storage.SbomDiffItem) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		out = append(out, map[string]any{
			"kind": it.Kind,
			"component": map[string]any{
				"id":        it.ComponentID.String(),
				"purl":      nullString(it.Purl),
				"name":      it.Name,
				"ecosystem": nullString(it.Ecosystem),
			},
			"old": map[string]any{
				"versions": it.OldVersion,
				"direct":   it.OldDirect,
			},
			"new": map[string]any{
				"versions": it.NewVersion,
				"direct":   it.NewDirect,
			},
		})
	}
	return out
}

func clampInt(v, min, max, def int) int {
	if v == 0 {
		return def
	}
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func maxInt(v, min int) int {
	if v < min {
		return min
	}
	return v
}
