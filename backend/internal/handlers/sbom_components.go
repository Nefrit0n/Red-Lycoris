package handlers

import (
	"database/sql"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type SbomComponentsHandler struct {
	db *sql.DB
}

func NewSbomComponentsHandler(db *sql.DB) *SbomComponentsHandler {
	return &SbomComponentsHandler{db: db}
}

func (h *SbomComponentsHandler) ListBySbom(c *fiber.Ctx) error {
	sbomID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid sbom id"})
	}

	item, err := storage.GetSbomByID(c.Context(), h.db, sbomID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom"})
	}
	if item == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "sbom not found"})
	}

	filters := parseSbomComponentFilters(c, sbomID)
	components, total, err := storage.ListSbomComponents(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to list components"})
	}

	response := make([]v1.SbomComponentDTO, 0, len(components))
	for _, comp := range components {
		response = append(response, sbomComponentToDTO(comp))
	}

	status := &v1.SbomIndexStatusDTO{
		Status:         item.IndexStatus,
		Error:          nullString(item.IndexError),
		ComponentCount: item.ComponentCount,
		EdgeCount:      item.EdgeCount,
		IndexedAt:      nullTimePtr(item.IndexedAt),
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": map[string]interface{}{
			"items":       response,
			"total":       total,
			"indexStatus": status,
		},
	})
}

func (h *SbomComponentsHandler) ListByProduct(c *fiber.Ctx) error {
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

	var items []v1.SbomComponentDTO
	var total int
	if indexedSbom != nil {
		filters := parseSbomComponentFilters(c, indexedSbom.ID)
		components, count, err := storage.ListSbomComponents(c.Context(), h.db, filters)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to list components"})
		}
		total = count
		items = make([]v1.SbomComponentDTO, 0, len(components))
		for _, comp := range components {
			items = append(items, sbomComponentToDTO(comp))
		}
	} else {
		items = []v1.SbomComponentDTO{}
		total = 0
	}

	var status *v1.SbomIndexStatusDTO
	if latestSbom != nil {
		status = &v1.SbomIndexStatusDTO{
			Status:         latestSbom.IndexStatus,
			Error:          nullString(latestSbom.IndexError),
			ComponentCount: latestSbom.ComponentCount,
			EdgeCount:      latestSbom.EdgeCount,
			IndexedAt:      nullTimePtr(latestSbom.IndexedAt),
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": map[string]interface{}{
			"items":       items,
			"total":       total,
			"indexStatus": status,
		},
	})
}

func (h *SbomComponentsHandler) Status(c *fiber.Ctx) error {
	sbomID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid sbom id"})
	}

	item, err := storage.GetSbomByID(c.Context(), h.db, sbomID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom"})
	}
	if item == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "sbom not found"})
	}

	status := v1.SbomIndexStatusDTO{
		Status:         item.IndexStatus,
		Error:          nullString(item.IndexError),
		ComponentCount: item.ComponentCount,
		EdgeCount:      item.EdgeCount,
		IndexedAt:      nullTimePtr(item.IndexedAt),
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true, "data": status})
}

func parseSbomComponentFilters(c *fiber.Ctx, sbomID uuid.UUID) storage.SbomComponentFilters {
	directOnly := parseBoolPtr(c.Query("directOnly"))
	limit := parseIntOrDefault(c.Query("limit"), 100)
	offset := parseIntOrDefault(c.Query("offset"), 0)

	license := strings.TrimSpace(c.Query("licenseContains"))
	if license == "" {
		license = strings.TrimSpace(c.Query("license"))
	}

	return storage.SbomComponentFilters{
		SbomID:     sbomID,
		DirectOnly: directOnly,
		Ecosystem:  strings.TrimSpace(c.Query("ecosystem")),
		License:    license,
		Query:      strings.TrimSpace(c.Query("q")),
		Limit:      limit,
		Offset:     offset,
	}
}

func parseBoolPtr(value string) *bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return nil
	}
	return &parsed
}

func parseIntOrDefault(value string, fallback int) int {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func sbomComponentToDTO(item storage.SbomComponentItem) v1.SbomComponentDTO {
	return v1.SbomComponentDTO{
		ID:        item.ID.String(),
		Purl:      nullString(item.Purl),
		Name:      item.Name,
		Version:   nullString(item.Version),
		Ecosystem: nullString(item.Ecosystem),
		Supplier:  nullString(item.Supplier),
		Licenses:  item.Licenses,
		Direct:    item.Direct,

		VulnTotal:    item.VulnTotal,
		VulnCritical: item.VulnCritical,
		VulnHigh:     item.VulnHigh,
		VulnMedium:   item.VulnMedium,
		VulnLow:      item.VulnLow,
	}
}

func nullTimePtr(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	v := value.Time
	return &v
}
