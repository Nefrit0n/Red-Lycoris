package api

import (
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/domain"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/parser"
	"redlycoris/internal/storage"
)

type importError struct {
	Index   int    `json:"index"`
	Message string `json:"message"`
}

func handleImport(repo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID := r.URL.Query().Get("project_id")
		var overrideProjectID uuid.UUID
		if projectID != "" {
			id, err := uuid.Parse(projectID)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project_id query param")
				return
			}
			overrideProjectID = id
		}
		user, _ := UserFromContext(r.Context())
		if !user.IsAdmin() {
			if overrideProjectID == uuid.Nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "project_id query param is required")
				return
			}
			role, has, err := rolesRepo.GetRole(r.Context(), user.ID, overrideProjectID)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
				return
			}
			if !has || role < domain.RoleTriager {
				respondError(w, r, http.StatusForbidden, "FORBIDDEN", "forbidden")
				return
			}
		}

		data, err := io.ReadAll(io.LimitReader(r.Body, 50<<20)) // 50MB limit
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "failed to read request body")
			return
		}

		format, findings, err := parser.DetectAndParse(r.Context(), data)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "PARSE_ERROR", err.Error())
			return
		}

		if len(findings) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "no findings found in input")
			return
		}

		var imported, updated int
		var errs []importError
		var importedIDs []uuid.UUID
		now := time.Now()

		for i := range findings {
			f := &findings[i]

			// Override project_id from query param if provided
			if overrideProjectID != uuid.Nil {
				f.ProjectID = overrideProjectID
			}

			if f.ProjectID == uuid.Nil {
				errs = append(errs, importError{Index: i, Message: "project_id is required"})
				continue
			}

			if f.FirstSeen.IsZero() {
				f.FirstSeen = now
			}
			if f.LastSeen.IsZero() {
				f.LastSeen = now
			}
			if f.TimesSeen == 0 {
				f.TimesSeen = 1
			}
			if f.Fingerprint == "" {
				f.Fingerprint = domain.CalculateFingerprint(f)
			}

			if err := f.Validate(); err != nil {
				errs = append(errs, importError{Index: i, Message: err.Error()})
				continue
			}

			isNew, err := repo.Create(r.Context(), f)
			if err != nil {
				slog.Error("import: failed to create finding", "index", i, "error", err)
				errs = append(errs, importError{Index: i, Message: "failed to save finding"})
				continue
			}

			if isNew {
				imported++
				importedIDs = append(importedIDs, f.ID)
			} else {
				updated++
			}
		}

		slog.Info("import completed",
			"format", format,
			"imported", imported,
			"updated", updated,
			"errors", len(errs),
		)

		// Публикуем импортированные findings в Redis Stream для обогащения
		if len(importedIDs) > 0 {
			if err := enrichment.PublishEnrichment(r.Context(), rdb, importedIDs...); err != nil {
				slog.Error("import: failed to publish enrichment", "error", err)
			}
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"format":   format,
			"imported": imported,
			"updated":  updated,
			"errors":   errs,
		})
	}
}
