package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/archive"
	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/importing"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/scanners"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const analysisConsumer = "analysis-worker"

type analysisMessage struct {
	JobID string `json:"job_id"`
}

func main() {
	cfg := config.Load()

	db, err := storage.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	store, err := objectstore.NewMinioStore(cfg)
	if err != nil {
		log.Fatalf("object store init failed: %v", err)
	}

	publisher, err := events.NewPublisher(cfg.NatsURL)
	if err != nil {
		log.Fatalf("nats connection failed: %v", err)
	}
	defer publisher.Close()

	js := publisher.JetStream()
	if js == nil {
		log.Fatalf("jetstream unavailable")
	}

	sub, err := js.PullSubscribe(events.AnalysisJobsSubject, analysisConsumer)
	if err != nil {
		log.Fatalf("failed to subscribe: %v", err)
	}

	cleanupInterval := parseDuration(cfg.AnalysisCleanupInterval, time.Hour)
	cleanupTTL := parseDuration(cfg.AnalysisCleanupTTL, 24*time.Hour)
	analysisTempDir := cfg.AnalysisTempDir
	if err := os.MkdirAll(analysisTempDir, 0o750); err != nil {
		log.Fatalf("failed to init temp dir: %v", err)
	}

	go periodicCleanup(db, store, analysisTempDir, cleanupTTL, cleanupInterval)

	for {
		msgs, err := sub.Fetch(1, nats.MaxWait(5*time.Second))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) {
				continue
			}
			log.Printf("fetch error: %v", err)
			continue
		}
		for _, msg := range msgs {
			if err := handleMessage(context.Background(), msg, db, store, publisher, cfg); err != nil {
				log.Printf("job failed: %v", err)
			}
		}
	}
}

func handleMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, store objectstore.Store, publisher *events.Publisher, cfg config.Config) error {
	var payload analysisMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return err
	}
	defer func() { _ = msg.Ack() }()

	jobID, err := uuid.Parse(payload.JobID)
	if err != nil {
		return err
	}

	job, err := storage.GetAnalysisJobByID(ctx, db, jobID)
	if err != nil || job == nil {
		return err
	}
	if job.Status != models.AnalysisJobQueued {
		return nil
	}

	startedAt := time.Now().UTC()
	if err := storage.UpdateAnalysisJobStatus(ctx, db, jobID, models.AnalysisJobProcessing, &startedAt, nil, nil); err != nil {
		return err
	}
	_ = publisher.PublishJSON(ctx, "analysis.started", buildEventPayload(job, models.AnalysisJobProcessing, startedAt, nil, nil))

	archiveKey := job.ArchiveKey
	if !archiveKey.Valid || archiveKey.String == "" {
		return fmt.Errorf("archive key missing")
	}

	jobDir := filepath.Join(cfg.AnalysisTempDir, jobID.String())
	archivePath := filepath.Join(jobDir, "archive")
	workspace := filepath.Join(jobDir, "src")

	if err := os.MkdirAll(jobDir, 0o750); err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
	}
	defer os.RemoveAll(jobDir)

	if err := downloadArchive(ctx, store, archiveKey.String, archivePath); err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
	}

	maxExtract := parseInt64(cfg.AnalysisMaxExtractBytes, 524288000)
	if err := archive.Extract(archivePath, workspace, maxExtract); err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
	}

	scannerCfg := scanners.RunnerConfig{
		ContainerNetwork: cfg.AnalysisContainerNetwork,
		SemgrepImage:     cfg.AnalysisSemgrepImage,
		TrivyImage:       cfg.AnalysisTrivyImage,
		Timeout:          parseDuration(cfg.AnalysisScannerTimeout, 20*time.Minute),
	}

	var totalNew, totalDuplicates, totalFindings int
	var scanErrors []string

	for _, scanner := range job.Scanners {
		scanner = strings.ToLower(strings.TrimSpace(scanner))
		result, err := runScanner(ctx, db, store, publisher, job, scanner, jobDir, workspace, scannerCfg)
		if err != nil {
			scanErrors = append(scanErrors, err.Error())
		}
		if result != nil {
			totalFindings += result.Total
			totalNew += result.New
			totalDuplicates += result.Duplicates
		}
	}

	if err := storage.UpdateAnalysisJobStats(ctx, db, job.ID, totalFindings, totalNew, totalDuplicates); err != nil {
		scanErrors = append(scanErrors, err.Error())
	}
	job.FindingsTotal = totalFindings
	job.FindingsNew = totalNew
	job.DuplicatesTotal = totalDuplicates

	if err := store.DeleteObject(ctx, archiveKey.String); err != nil {
		scanErrors = append(scanErrors, fmt.Sprintf("failed to delete archive: %v", err))
	} else {
		_ = storage.UpdateAnalysisJobArchiveKey(ctx, db, job.ID, nil, 0)
	}

	status := models.AnalysisJobSucceeded
	var finalErr error
	if len(scanErrors) > 0 {
		status = models.AnalysisJobFailed
		finalErr = errors.New(strings.Join(scanErrors, "; "))
	}

	return finalizeJob(ctx, db, publisher, job, status, startedAt, finalErr)
}

func runScanner(ctx context.Context, db *sql.DB, store objectstore.Store, publisher *events.Publisher, job *storage.AnalysisJobDetail, scanner string, jobDir string, workspace string, cfg scanners.RunnerConfig) (*importing.ImportResult, error) {
	resultPath := filepath.Join(jobDir, fmt.Sprintf("result_%s.json", scanner))

	var scanErr error
	switch scanner {
	case "semgrep":
		scanErr = scanners.RunSemgrep(ctx, cfg, workspace, resultPath)
	case "trivy":
		scanErr = scanners.RunTrivy(ctx, cfg, workspace, resultPath)
	default:
		return nil, fmt.Errorf("unsupported scanner: %s", scanner)
	}

	status := models.AnalysisScannerSucceeded
	if scanErr != nil {
		status = models.AnalysisScannerFailed
	}

	// Upload artifact
	artifactKey := fmt.Sprintf("analysis/%s/artifacts/%s.json", job.ID.String(), scanner)
	var artifactUploaded bool
	if _, err := os.Stat(resultPath); err == nil {
		if file, err := os.Open(resultPath); err == nil {
			defer file.Close()
			if info, err := file.Stat(); err == nil {
				if err := store.PutObject(ctx, artifactKey, file, info.Size(), "application/json"); err == nil {
					artifactUploaded = true
				}
			}
		}
	}

	var artifactKeyPtr *string
	if artifactUploaded {
		artifactKeyPtr = &artifactKey
	}

	// Import findings
	var importJobID *uuid.UUID
	var importResult *importing.ImportResult
	var importErr error

	if artifactUploaded {
		if bytes, err := os.ReadFile(resultPath); err == nil {
			importResult, importErr = importing.ImportFindings(ctx, db, importing.ImportParams{
				Scanner:      scanner,
				Report:       bytes,
				SourceType:   "scanner",
				ProductID:    importing.NullUUIDPtr(job.ProductID),
				EngagementID: importing.NullUUIDPtr(job.EngagementID),
				CreatedBy:    importing.NullUUIDPtr(job.CreatedBy),
				TenantID:     importing.NullUUIDPtr(job.TenantID),
				Callbacks: &importing.ImportCallbacks{
					OnIdentifiersDetected: func(identifiers []string) {
						if publisher == nil || len(identifiers) == 0 {
							return
						}
						var productPtr *string
						if job.ProductID.Valid {
							value := job.ProductID.UUID.String()
							productPtr = &value
						}
						_ = publisher.PublishJSON(ctx, events.IntelEnrichRequested, events.IntelEnrichRequest{
							Identifiers: identifiers,
							ProductID:   productPtr,
							Source:      "analysis_worker",
						})
					},
				},
			})
			if importResult != nil {
				importJobID = &importResult.ImportJobID
			}
		}
	}

	if importErr != nil {
		status = models.AnalysisScannerFailed
	}

	if err := storage.UpdateAnalysisJobScanner(ctx, db, job.ID, scanner, status, importJobID, artifactKeyPtr); err != nil {
		return importResult, err
	}

	if scanErr != nil {
		return importResult, scanErr
	}
	if importErr != nil {
		return importResult, importErr
	}
	return importResult, nil
}

func downloadArchive(ctx context.Context, store objectstore.Store, key string, destination string) error {
	reader, err := store.GetObject(ctx, key)
	if err != nil {
		return err
	}
	defer reader.Close()

	out, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, reader)
	return err
}

func finalizeJob(ctx context.Context, db *sql.DB, publisher *events.Publisher, job *storage.AnalysisJobDetail, status string, startedAt time.Time, err error) error {
	finishedAt := time.Now().UTC()
	var errMsg *string
	if err != nil {
		message := err.Error()
		errMsg = &message
	}
	if err := storage.UpdateAnalysisJobStatus(ctx, db, job.ID, status, nil, &finishedAt, errMsg); err != nil {
		return err
	}
	payload := buildEventPayload(job, status, startedAt, &finishedAt, errMsg)
	if status == models.AnalysisJobFailed {
		_ = publisher.PublishJSON(ctx, "analysis.failed", payload)
	} else {
		_ = publisher.PublishJSON(ctx, "analysis.completed", payload)
	}
	return nil
}

func buildEventPayload(job *storage.AnalysisJobDetail, status string, startedAt time.Time, finishedAt *time.Time, errMsg *string) map[string]any {
	payload := map[string]any{
		"job_id":     job.ID.String(),
		"scanners":   job.Scanners,
		"status":     status,
		"created_at": job.CreatedAt.Format(time.RFC3339),
		"stats": map[string]int{
			"findings_total": job.FindingsTotal,
			"findings_new":   job.FindingsNew,
			"duplicates":     job.DuplicatesTotal,
		},
	}
	if job.ProductID.Valid {
		payload["product_id"] = job.ProductID.UUID.String()
	}
	if job.CreatedBy.Valid {
		payload["actor"] = job.CreatedBy.UUID.String()
	}
	if !startedAt.IsZero() {
		payload["started_at"] = startedAt.Format(time.RFC3339)
	}
	if finishedAt != nil {
		payload["finished_at"] = finishedAt.Format(time.RFC3339)
	}
	if errMsg != nil {
		payload["error"] = *errMsg
	}
	return payload
}

func periodicCleanup(db *sql.DB, store objectstore.Store, tempDir string, ttl time.Duration, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		cleanupTempDir(tempDir, ttl)
		cleanupArchives(db, store, ttl)
	}
}

func cleanupTempDir(tempDir string, ttl time.Duration) {
	entries, err := os.ReadDir(tempDir)
	if err != nil {
		return
	}
	threshold := time.Now().Add(-ttl)
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(threshold) {
			_ = os.RemoveAll(filepath.Join(tempDir, entry.Name()))
		}
	}
}

func cleanupArchives(db *sql.DB, store objectstore.Store, ttl time.Duration) {
	ctx := context.Background()
	olderThan := time.Now().Add(-ttl)
	jobs, err := storage.ListAnalysisJobsWithArchiveCleanup(ctx, db, olderThan, 50)
	if err != nil {
		return
	}
	for _, job := range jobs {
		if !job.ArchiveKey.Valid {
			continue
		}
		_ = store.DeleteObject(ctx, job.ArchiveKey.String)
		_ = storage.UpdateAnalysisJobArchiveKey(ctx, db, job.ID, nil, 0)
	}
}

func parseDuration(value string, fallback time.Duration) time.Duration {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	duration, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return duration
}

func parseInt64(value string, fallback int64) int64 {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
