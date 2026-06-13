package api

import (
	"encoding/json"
	"errors"
	"io"
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
	const defaultFormMemory = int64(8 << 20)
	mb, err := strconv.Atoi(strings.TrimSpace(os.Getenv("RL_MAX_SCAN_FORM_MEMORY_MB")))
	if err != nil || mb <= 0 {
		return defaultFormMemory
	}
	return int64(mb) << 20
}

// handleSubmitToolRun принимает отчёт сканера и добавляет его как tool-run к скану.
// Первый вызов с новым pipeline_id создаёт скан; последующие — добавляют tool-run.
// Если pipeline_id не передан — создаёт одноинструментный скан и сразу закрывает его.
func handleSubmitToolRun(scansRepo *storage.ScansRepo, findingsRepo *storage.FindingsRepo) http.HandlerFunc {
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

		pipelineID := strings.TrimSpace(r.FormValue("pipeline_id"))
		commitSHA := strings.TrimSpace(r.FormValue("commit_sha"))
		branch := strings.TrimSpace(r.FormValue("branch"))
		scanner := strings.TrimSpace(r.FormValue("scanner"))
		scannerVersion := strings.TrimSpace(r.FormValue("scanner_version"))
		ciJobURL := strings.TrimSpace(r.FormValue("ci_job_url"))
		assetHint := strings.TrimSpace(r.FormValue("asset_hint"))

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

		// Синтетический pipeline_id для ручной/UI-загрузки — скан сразу закрывается.
		isManual := pipelineID == ""
		if isManual {
			pipelineID = uuid.New().String()
		}

		tokenID, _ := uuid.Parse(tok.TokenID)
		scan := &domain.Scan{
			ProjectID:    projectID,
			CIPipelineID: &pipelineID,
			TokenID:      &tokenID,
		}
		if commitSHA != "" {
			scan.CommitSHA = &commitSHA
		}
		if branch != "" {
			scan.Branch = &branch
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

		// Апсерт скана: первая отправка создаёт (status=open), последующие — находят существующий.
		if _, err = scansRepo.UpsertByPipeline(r.Context(), tx, scan); err != nil {
			_ = tx.Rollback(r.Context())
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to upsert scan")
			return
		}

		detected, findings, parseErr := parser.DetectAndParse(r.Context(), data)
		if scanner == "" {
			if detected != "" {
				scanner = detected
			} else {
				scanner = "unknown"
			}
		}
		reportFormat := detected
		if reportFormat == "" {
			reportFormat = scanner
		}

		toolRun := &domain.ScanToolRun{
			ScanID:       scan.ID,
			Scanner:      scanner,
			ReportFormat: reportFormat,
			StartedAt:    start,
		}
		if scannerVersion != "" {
			toolRun.ScannerVersion = &scannerVersion
		}

		// Битый отчёт: tool-run failed, скан остаётся живым (если не isManual).
		if parseErr != nil {
			errMsg := parseErr.Error()
			toolRun.Status = "failed"
			toolRun.Error = &errMsg
			toolRun.FinishedAt = time.Now()
			if err := scansRepo.CreateToolRun(r.Context(), tx, toolRun); err != nil {
				_ = tx.Rollback(r.Context())
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to record tool run")
				return
			}
			if isManual {
				if err := scansRepo.CompleteScan(r.Context(), tx, scan.ID, "auto"); err != nil {
					_ = tx.Rollback(r.Context())
					respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to close scan")
					return
				}
			}
			if err := tx.Commit(r.Context()); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to commit")
				return
			}
			respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
				"scan_id":     scan.ID,
				"tool_run_id": toolRun.ID,
				"pipeline_id": pipelineID,
				"status":      "failed",
				"error":       errMsg,
			}})
			return
		}

		// Один проход: дедуп + запоминание флагов isNew для привязки к tool_run.
		type findingResult struct {
			id    uuid.UUID
			isNew bool
		}
		results := make([]findingResult, 0, len(findings))
		imported, updated := 0, 0
		now := time.Now()

		for i := range findings {
			f := &findings[i]
			f.ProjectID = projectID
			if commitSHA != "" {
				f.CommitSHA = &commitSHA
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
			isNew, err := findingsRepo.CreateTx(r.Context(), tx, f)
			if err != nil {
				_ = tx.Rollback(r.Context())
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to upsert finding")
				return
			}
			results = append(results, findingResult{id: f.ID, isNew: isNew})
			if isNew {
				imported++
			} else {
				updated++
			}
		}

		toolRun.Status = "success"
		toolRun.FindingsImported = imported
		toolRun.FindingsUpdated = updated
		toolRun.FinishedAt = time.Now()
		if err := scansRepo.CreateToolRun(r.Context(), tx, toolRun); err != nil {
			_ = tx.Rollback(r.Context())
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to record tool run")
			return
		}

		for _, res := range results {
			if err := scansRepo.LinkFinding(r.Context(), tx, res.id, scan.ID, toolRun.ID, res.isNew); err != nil {
				_ = tx.Rollback(r.Context())
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to link finding")
				return
			}
		}

		if err := scansRepo.IncrScanCounts(r.Context(), tx, scan.ID, imported, updated); err != nil {
			_ = tx.Rollback(r.Context())
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update scan counts")
			return
		}

		if isManual {
			if err := scansRepo.CompleteScan(r.Context(), tx, scan.ID, "auto"); err != nil {
				_ = tx.Rollback(r.Context())
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to close scan")
				return
			}
		}

		if err := tx.Commit(r.Context()); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to commit scan")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"scan_id":       scan.ID,
			"tool_run_id":   toolRun.ID,
			"pipeline_id":   pipelineID,
			"scanner":       scanner,
			"report_format": reportFormat,
			"status":        "success",
			"imported":      imported,
			"updated":       updated,
			"duration_ms":   time.Since(start).Milliseconds(),
		}})
	}
}

// handleCompleteScan закрывает скан явно по pipeline_id.
// Идемпотентен: повторный вызов на уже закрытый скан возвращает его текущее состояние.
func handleCompleteScan(scansRepo *storage.ScansRepo) http.HandlerFunc {
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

		var body struct {
			PipelineID string `json:"pipeline_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.PipelineID) == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "pipeline_id is required")
			return
		}

		// UPDATE ... WHERE status='open' RETURNING: если скан уже закрыт — RowsAffected=0, pgx вернёт ErrNoRows.
		scan, err := scansRepo.CompletePipeline(r.Context(), projectID, body.PipelineID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// Идемпотентность: скан уже закрыт или не найден — вернуть текущее состояние.
				scan, err = scansRepo.GetByPipeline(r.Context(), projectID, body.PipelineID)
				if err != nil {
					if errors.Is(err, pgx.ErrNoRows) {
						respondError(w, r, http.StatusNotFound, "NOT_FOUND", "scan not found")
					} else {
						respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get scan")
					}
					return
				}
			} else {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to complete scan")
				return
			}
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"scan_id":      scan.ID,
			"status":       scan.Status,
			"completion":   scan.Completion,
			"completed_at": scan.CompletedAt,
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

		toolRuns, err := scansRepo.ListToolRuns(r.Context(), scanID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list tool runs")
			return
		}
		findings, err := scansRepo.ListFindings(r.Context(), scanID, 200)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list scan findings")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"scan":      scan,
			"tool_runs": toolRuns,
			"findings":  findings,
		}})
	}
}
