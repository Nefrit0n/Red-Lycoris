package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"vulnscope/internal/domain"
	"vulnscope/internal/storage"
)

type importRequest struct {
	ProjectID  uuid.UUID       `json:"project_id"`
	SourceType string          `json:"source_type"`
	Findings   []importFinding `json:"findings"`
}

type importFinding struct {
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Severity         int      `json:"severity"`
	Confidence       int      `json:"confidence"`
	FilePath         string   `json:"file_path"`
	LineStart        int      `json:"line_start"`
	LineEnd          int      `json:"line_end"`
	Component        string   `json:"component"`
	ComponentVersion string   `json:"component_version"`
	CVEIDs           []string `json:"cve_ids"`
	CWEIDs           []int    `json:"cwe_ids"`
	CPEURI           string   `json:"cpe_uri"`
}

type importError struct {
	Index   int    `json:"index"`
	Message string `json:"message"`
}

func handleImport(repo *storage.FindingsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req importRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		if req.ProjectID == uuid.Nil {
			respondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "project_id is required")
			return
		}
		if req.SourceType == "" {
			respondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "source_type is required")
			return
		}
		if len(req.Findings) == 0 {
			respondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "findings must not be empty")
			return
		}

		var imported, updated int
		var errs []importError
		now := time.Now()

		for i, item := range req.Findings {
			f := domain.Finding{
				Title:            item.Title,
				Description:      item.Description,
				Severity:         item.Severity,
				Confidence:       item.Confidence,
				Status:           domain.StatusOpen,
				FilePath:         item.FilePath,
				LineStart:        item.LineStart,
				LineEnd:          item.LineEnd,
				Component:        item.Component,
				ComponentVersion: item.ComponentVersion,
				CVEIDs:           item.CVEIDs,
				CWEIDs:           item.CWEIDs,
				CPEURI:           item.CPEURI,
				ProjectID:        req.ProjectID,
				SourceType:       req.SourceType,
				FirstSeen:        now,
				LastSeen:         now,
				TimesSeen:        1,
			}

			if f.CVEIDs == nil {
				f.CVEIDs = []string{}
			}
			if f.CWEIDs == nil {
				f.CWEIDs = []int{}
			}

			f.Fingerprint = domain.CalculateFingerprint(&f)

			if err := f.Validate(); err != nil {
				errs = append(errs, importError{Index: i, Message: err.Error()})
				continue
			}

			isNew, err := repo.Create(r.Context(), &f)
			if err != nil {
				slog.Error("import: failed to create finding", "index", i, "error", err)
				errs = append(errs, importError{Index: i, Message: "failed to save finding"})
				continue
			}

			if isNew {
				imported++
			} else {
				updated++
			}
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"imported": imported,
			"updated":  updated,
			"errors":   errs,
		})
	}
}
