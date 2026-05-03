package api

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"redlycoris/internal/domain"
	"redlycoris/internal/parser"
	"redlycoris/internal/storage"
)

func maxScanSizeBytes() int64 {
	mb, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("RL_MAX_SCAN_SIZE_MB")))
	if mb <= 0 {
		mb = 50
	}
	return int64(mb) << 20
}

func maxScanFormMemoryBytes() int64 {
	// Keep in-memory multipart form usage bounded to avoid memory exhaustion.
	const defaultFormMemory = int64(8 << 20)
	mb, err := strconv.Atoi(strings.TrimSpace(os.Getenv("RL_MAX_SCAN_FORM_MEMORY_MB")))
	if err != nil || mb <= 0 {
		return defaultFormMemory
	}
	return int64(mb) << 20
}
func handleCreateScan(scansRepo *storage.ScansRepo, findingsRepo *storage.FindingsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok, ok := APITokenFromContext(r.Context())
		if !ok {
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "api token required")
			return
		}
		projectID, err := uuid.Parse(tok.ProjectID)
		if err != nil {
			respondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid api token")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxScanSizeBytes())
		mr, err := r.MultipartReader()
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid multipart form")
			return
		}
		form, err := mr.ReadForm(maxScanFormMemoryBytes())
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid multipart form")
			return
		}
		defer func() { _ = form.RemoveAll() }()
		r.MultipartForm = form
		if r.URL.Query().Get("project_id") != "" {
			slog.Warn("scans: project_id query ignored for PAT request", "request_id", GetRequestID(r.Context()))
		}
		commitSHA := strings.TrimSpace(r.FormValue("commit_sha"))
		branch := strings.TrimSpace(r.FormValue("branch"))
		scanner := strings.TrimSpace(r.FormValue("scanner"))
		scannerVersion := strings.TrimSpace(r.FormValue("scanner_version"))
		ciJobURL := strings.TrimSpace(r.FormValue("ci_job_url"))
		assetHint := strings.TrimSpace(r.FormValue("asset_hint"))
		if commitSHA == "" || branch == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "commit_sha and branch are required")
			return
		}

		files := r.MultipartForm.File["report"]
		if len(files) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "report is required")
			return
		}
		hdr := files[0]
		file, err := hdr.Open()
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "failed to open report")
			return
		}
		defer file.Close()
		data, err := io.ReadAll(io.LimitReader(file, maxScanSizeBytes()))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "failed to read report")
			return
		}

		if scanner == "" {
			scanner = "unknown"
		}

		tokenID, _ := uuid.Parse(tok.TokenID)
		rawSize := int(hdr.Size)
		scan := &domain.Scan{
			ProjectID: projectID, CommitSHA: commitSHA, Branch: branch,
			Scanner: scanner, Status: domain.ScanStatusRunning,
			TokenID: &tokenID, RawReportSize: &rawSize,
		}
		if scannerVersion != "" {
			scan.ScannerVersion = &scannerVersion
		}
		if ciJobURL != "" {
			scan.CIJobURL = &ciJobURL
		}
		if assetHint != "" {
			scan.AssetHint = &assetHint
		}

		start := time.Now()
		tx, err := findingsRepo.DB().Begin(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to begin transaction")
			return
		}
		if err := scansRepo.Create(r.Context(), tx, scan); err != nil {
			_ = tx.Rollback(r.Context())
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create scan")
			return
		}

		detected, findings, err := parser.DetectAndParse(r.Context(), data)
		if err != nil {
			_ = tx.Rollback(r.Context())
			_ = scansRepo.Fail(r.Context(), scan.ID)
			respondError(w, r, http.StatusBadRequest, "PARSE_ERROR", err.Error())
			return
		}
		if detected != "" && scan.Scanner == "unknown" {
			scan.Scanner = detected
		}

		imported, updated := 0, 0
		now := time.Now()
		for i := range findings {
			f := &findings[i]
			f.ProjectID = projectID
			f.CommitSHA = &commitSHA
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
			// CreateTx runs inside the same transaction so findings+links are atomic
			isNew, err := findingsRepo.CreateTx(r.Context(), tx, f)
			if err != nil {
				_ = tx.Rollback(r.Context())
				_ = scansRepo.Fail(r.Context(), scan.ID)
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to upsert finding")
				return
			}
			if err := scansRepo.LinkFinding(r.Context(), tx, f.ID, scan.ID, isNew); err != nil {
				_ = tx.Rollback(r.Context())
				_ = scansRepo.Fail(r.Context(), scan.ID)
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to link finding to scan")
				return
			}
			if isNew {
				imported++
			} else {
				updated++
			}
		}
		if err := scansRepo.Complete(r.Context(), tx, scan.ID, domain.ScanStatusCompleted, scan.Scanner, imported, updated); err != nil {
			_ = tx.Rollback(r.Context())
			_ = scansRepo.Fail(r.Context(), scan.ID)
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to finalize scan")
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			_ = scansRepo.Fail(r.Context(), scan.ID)
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to commit scan")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"scan_id":     scan.ID,
			"scanner":     scan.Scanner,
			"imported":    imported,
			"updated":     updated,
			"skipped":     0,
			"duration_ms": time.Since(start).Milliseconds(),
		}})
	}
}

func handleListScans(scansRepo *storage.ScansRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		limit := 50
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil {
				limit = n
			}
		}
		scans, cursor, err := scansRepo.ListByProject(r.Context(), storage.ScanListFilter{
			ProjectID: projectID,
			Branch:    r.URL.Query().Get("branch"),
			Scanner:   r.URL.Query().Get("scanner"),
			Status:    r.URL.Query().Get("status"),
			Cursor:    r.URL.Query().Get("cursor"),
			Limit:     limit,
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list scans")
			return
		}
		respondList(w, scans, len(scans), cursor)
	}
}

func handleGetScan(scansRepo *storage.ScansRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scanID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid scan id")
			return
		}
		scan, err := scansRepo.Get(r.Context(), scanID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "scan not found")
			} else {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get scan")
			}
			return
		}

		// Verify the caller has at least viewer access to the scan's project.
		user, hasUser := UserFromContext(r.Context())
		patTok, hasPAT := APITokenFromContext(r.Context())
		switch {
		case hasPAT:
			if patTok.ProjectID != scan.ProjectID.String() {
				respondError(w, r, http.StatusForbidden, "FORBIDDEN", "token does not belong to this project")
				return
			}
		case hasUser:
			if !user.IsAdmin() {
				role, found, roleErr := rolesRepo.GetRole(r.Context(), user.ID, scan.ProjectID)
				if roleErr != nil || !found || role < domain.RoleViewer {
					respondError(w, r, http.StatusForbidden, "FORBIDDEN", "access denied")
					return
				}
			}
		default:
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
			return
		}

		findings, err := scansRepo.ListFindings(r.Context(), scanID, 200)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list scan findings")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"scan": scan, "findings": findings}})
	}
}
