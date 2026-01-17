package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/dedup"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/parser"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const (
	analysisConsumer = "analysis-worker"
)

type analysisMessage struct {
	JobID string `json:"job_id"`
}

type importStats struct {
	ImportJobID uuid.UUID
	Findings    int
	New         int
	Duplicates  int
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
	defer func() {
		_ = msg.Ack()
	}()
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
		_ = msg.Ack()
		return err
	}
	_ = publisher.PublishJSON(ctx, "analysis.started", eventPayload(job, models.AnalysisJobProcessing, startedAt, nil, nil))

	archiveKey := job.ArchiveKey
	if !archiveKey.Valid || archiveKey.String == "" {
		_ = msg.Ack()
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
	if err := extractArchive(archivePath, workspace, maxExtract); err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
	}

	scannerTimeout := parseDuration(cfg.AnalysisScannerTimeout, 20*time.Minute)
	stats := []importStats{}
	var scanErrors []string

	for _, scanner := range job.Scanners {
		scanner = strings.ToLower(strings.TrimSpace(scanner))
		switch scanner {
		case "semgrep":
			resultPath := filepath.Join(jobDir, "result_semgrep.json")
			err := runSemgrep(ctx, cfg, workspace, resultPath, scannerTimeout)
			stats, err = handleScannerResult(ctx, db, store, job, scanner, resultPath, err, stats)
			if err != nil {
				scanErrors = append(scanErrors, err.Error())
			}
		case "trivy":
			resultPath := filepath.Join(jobDir, "trivy_result.json")
			err := runTrivy(ctx, cfg, workspace, resultPath, scannerTimeout)
			stats, err = handleScannerResult(ctx, db, store, job, scanner, resultPath, err, stats)
			if err != nil {
				scanErrors = append(scanErrors, err.Error())
			}
		}
	}

	var total, totalNew, totalDuplicates int
	for _, stat := range stats {
		total += stat.Findings
		totalNew += stat.New
		totalDuplicates += stat.Duplicates
	}
	if err := storage.UpdateAnalysisJobStats(ctx, db, job.ID, total, totalNew, totalDuplicates); err != nil {
		scanErrors = append(scanErrors, err.Error())
	}
	job.FindingsTotal = total
	job.FindingsNew = totalNew
	job.DuplicatesTotal = totalDuplicates

	if err := store.DeleteObject(ctx, archiveKey.String); err != nil {
		scanErrors = append(scanErrors, fmt.Sprintf("failed to delete archive: %v", err))
	} else {
		_ = storage.UpdateAnalysisJobArchiveKey(ctx, db, job.ID, nil, 0)
	}

	status := models.AnalysisJobSucceeded
	if len(scanErrors) > 0 {
		status = models.AnalysisJobFailed
	}

	var finalErr error
	if len(scanErrors) > 0 {
		finalErr = errors.New(strings.Join(scanErrors, "; "))
	}
	return finalizeJob(ctx, db, publisher, job, status, startedAt, finalErr)
}

func handleScannerResult(ctx context.Context, db *sql.DB, store objectstore.Store, job *storage.AnalysisJobDetail, scanner string, resultPath string, scanErr error, stats []importStats) ([]importStats, error) {
	status := models.AnalysisScannerSucceeded
	if scanErr != nil {
		status = models.AnalysisScannerFailed
	}

	artifactKey := fmt.Sprintf("analysis/%s/artifacts/%s.json", job.ID.String(), scanner)
	var artifactUploaded bool
	if _, err := os.Stat(resultPath); err == nil {
		file, err := os.Open(resultPath)
		if err == nil {
			defer file.Close()
			info, _ := file.Stat()
			if err := store.PutObject(ctx, artifactKey, file, info.Size(), "application/json"); err == nil {
				artifactUploaded = true
			}
		}
	}

	var artifactKeyPtr *string
	if artifactUploaded {
		artifactKeyPtr = &artifactKey
	}

	var importJobID *uuid.UUID
	var importErr error
	if artifactUploaded {
		bytes, err := os.ReadFile(resultPath)
		if err == nil {
			stat, err := importFindings(ctx, db, job, scanner, bytes)
			if err != nil {
				importErr = err
			} else {
				importJobID = &stat.ImportJobID
				stats = append(stats, stat)
			}
		}
	}

	if importErr != nil {
		status = models.AnalysisScannerFailed
	}

	if err := storage.UpdateAnalysisJobScanner(ctx, db, job.ID, scanner, status, importJobID, artifactKeyPtr); err != nil {
		return stats, err
	}

	if scanErr != nil {
		return stats, scanErr
	}
	if importErr != nil {
		return stats, importErr
	}
	return stats, nil
}

func importFindings(ctx context.Context, db *sql.DB, job *storage.AnalysisJobDetail, scanner string, report []byte) (importStats, error) {
	checksum := computeChecksum(report)
	importJob := &models.ImportJob{
		Scanner:   scanner,
		Status:    models.ImportJobQueued,
		Checksum:  checksum,
		CreatedBy: nullUUIDPtr(job.CreatedBy),
	}
	if job.ProductID.Valid {
		value := job.ProductID.UUID
		importJob.ProductID = &value
	}
	if err := storage.CreateImportJob(ctx, db, importJob); err != nil {
		return importStats{}, err
	}

	startedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobRunning, &startedAt, nil, nil); err != nil {
		return importStats{}, err
	}

	findings, err := parser.ParseReport(scanner, report)
	if err != nil {
		finishedAt := time.Now().UTC()
		errMsg := err.Error()
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		return importStats{}, err
	}

	var productID *uuid.UUID
	if job.ProductID.Valid {
		value := job.ProductID.UUID
		productID = &value
	}
	var engagementID *uuid.UUID
	if job.EngagementID.Valid {
		value := job.EngagementID.UUID
		engagementID = &value
	}

	scan := &models.ScanResult{
		EngagementID: engagementID,
		ProductID:    productID,
		UploaderID:   nullUUIDPtr(job.CreatedBy),
		ImportJobID:  &importJob.ID,
		Scanner:      scanner,
		RawReport:    report,
	}
	if err := storage.CreateScanResult(ctx, db, scan); err != nil {
		finishedAt := time.Now().UTC()
		errMsg := "failed to store scan result"
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		return importStats{}, err
	}

	duplicates := 0
	createdFindings := 0
	seenAt := time.Now().UTC()

	for _, finding := range findings {
		fingerprint := dedup.ComputeFingerprint(scanner, finding)

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return importStats{}, err
		}

		var masterID uuid.UUID
		var repeatCount int
		query := `SELECT id, repeat_count
		 FROM findings
		 WHERE fingerprint = $1
		   AND duplicate_id IS NULL
		   AND deleted_at IS NULL`
		args := []interface{}{fingerprint}
		if productID != nil {
			query += " AND product_id = $2"
			args = append(args, *productID)
		} else {
			query += " AND product_id IS NULL"
		}
		query += " LIMIT 1 FOR UPDATE"
		err = tx.QueryRowContext(ctx, query, args...).Scan(&masterID, &repeatCount)
		if err != nil && err != sql.ErrNoRows {
			_ = tx.Rollback()
			return importStats{}, err
		}

		if err == sql.ErrNoRows {
			model := &models.Finding{
				ScanResultID: &scan.ID,
				ProductID:    productID,
				Fingerprint:  fingerprint,
				Title:        finding.Title,
				Description:  finding.Description,
				Severity:     finding.Severity,
				Status:       models.StatusNew,
				ImportJobID:  &importJob.ID,
				FirstSeenAt:  seenAt,
				LastSeenAt:   seenAt,
				RepeatCount:  0,
			}
			if err := storage.CreateFindingTx(ctx, tx, model); err != nil {
				_ = tx.Rollback()
				return importStats{}, err
			}
			if err := tx.Commit(); err != nil {
				return importStats{}, err
			}
			createdFindings++
			continue
		}

		duplicate := &models.Finding{
			ScanResultID: &scan.ID,
			ProductID:    productID,
			Fingerprint:  fingerprint,
			Title:        finding.Title,
			Description:  finding.Description,
			Severity:     finding.Severity,
			Status:       models.StatusDuplicate,
			DuplicateID:  &masterID,
			ImportJobID:  &importJob.ID,
			FirstSeenAt:  seenAt,
			LastSeenAt:   seenAt,
			RepeatCount:  0,
		}
		if err := storage.CreateFindingTx(ctx, tx, duplicate); err != nil {
			_ = tx.Rollback()
			return importStats{}, err
		}
		if _, err := tx.ExecContext(
			ctx,
			`UPDATE findings
			 SET repeat_count = $1,
			     last_seen_at = $2,
			     updated_at = $2
			 WHERE id = $3`,
			repeatCount+1,
			seenAt,
			masterID,
		); err != nil {
			_ = tx.Rollback()
			return importStats{}, err
		}
		if err := tx.Commit(); err != nil {
			return importStats{}, err
		}

		duplicates++
	}

	if productID != nil {
		_ = storage.UpdateImportJobProductID(ctx, db, importJob.ID, *productID)
	}

	if err := storage.UpdateImportJobStats(ctx, db, importJob.ID, len(findings), createdFindings, duplicates); err != nil {
		return importStats{}, err
	}

	finishedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobSucceeded, nil, &finishedAt, nil); err != nil {
		return importStats{}, err
	}

	return importStats{
		ImportJobID: importJob.ID,
		Findings:    len(findings),
		New:         createdFindings,
		Duplicates:  duplicates,
	}, nil
}

func runSemgrep(ctx context.Context, cfg config.Config, workspace string, outputPath string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		"docker",
		"run",
		"--rm",
		"--network", cfg.AnalysisContainerNetwork,
		"-v", fmt.Sprintf("%s:/src:ro", workspace),
		"-v", fmt.Sprintf("%s:/out", filepath.Dir(outputPath)),
		cfg.AnalysisSemgrepImage,
		"semgrep",
		"--config=auto",
		"--json",
		"--output", "/out/"+filepath.Base(outputPath),
		"/src",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("semgrep failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func runTrivy(ctx context.Context, cfg config.Config, workspace string, outputPath string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		"docker",
		"run",
		"--rm",
		"--network", cfg.AnalysisContainerNetwork,
		"-v", fmt.Sprintf("%s:/src:ro", workspace),
		"-v", fmt.Sprintf("%s:/out", filepath.Dir(outputPath)),
		cfg.AnalysisTrivyImage,
		"fs",
		"--scanners", "vuln,secret,misconfig",
		"--format", "json",
		"--output", "/out/"+filepath.Base(outputPath),
		"--exit-code", "0",
		"--skip-db-update",
		"/src",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("trivy failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return nil
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

func extractArchive(archivePath string, dest string, maxBytes int64) error {
	if err := os.MkdirAll(dest, 0o750); err != nil {
		return err
	}

	lower := strings.ToLower(archivePath)
	if strings.HasSuffix(lower, ".zip") {
		return extractZip(archivePath, dest, maxBytes)
	}
	return extractTarGz(archivePath, dest, maxBytes)
}

func extractZip(path string, dest string, maxBytes int64) error {
	r, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer r.Close()

	var extracted int64
	for _, f := range r.File {
		if err := validateArchivePath(dest, f.Name); err != nil {
			return err
		}
		targetPath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o750); err != nil {
				return err
			}
			continue
		}
		if f.Mode()&os.ModeSymlink != 0 {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o750); err != nil {
			return err
		}
		in, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(targetPath)
		if err != nil {
			in.Close()
			return err
		}
		written, err := io.Copy(out, in)
		in.Close()
		out.Close()
		if err != nil {
			return err
		}
		extracted += written
		if extracted > maxBytes {
			return fmt.Errorf("extracted content exceeds limit")
		}
	}
	return nil
}

func extractTarGz(path string, dest string, maxBytes int64) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	gz, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	var extracted int64

	for {
		header, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		if err := validateArchivePath(dest, header.Name); err != nil {
			return err
		}
		if header.Typeflag == tar.TypeSymlink || header.Typeflag == tar.TypeLink {
			continue
		}
		targetPath := filepath.Join(dest, header.Name)
		if header.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o750); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o750); err != nil {
			return err
		}
		out, err := os.Create(targetPath)
		if err != nil {
			return err
		}
		written, err := io.Copy(out, tr)
		out.Close()
		if err != nil {
			return err
		}
		extracted += written
		if extracted > maxBytes {
			return fmt.Errorf("extracted content exceeds limit")
		}
	}
	return nil
}

func validateArchivePath(dest string, name string) error {
	if strings.Contains(name, "..") {
		return fmt.Errorf("invalid archive entry")
	}
	clean := filepath.Clean(name)
	if filepath.IsAbs(clean) {
		return fmt.Errorf("invalid archive entry")
	}
	target := filepath.Join(dest, clean)
	if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
		return fmt.Errorf("invalid archive entry")
	}
	return nil
}

func computeChecksum(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func nullUUIDPtr(value uuid.NullUUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	return &value.UUID
}

func uuidNullToString(value uuid.NullUUID) *string {
	if !value.Valid {
		return nil
	}
	output := value.UUID.String()
	return &output
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
	payload := eventPayload(job, status, startedAt, &finishedAt, errMsg)
	if status == models.AnalysisJobFailed {
		_ = publisher.PublishJSON(ctx, "analysis.failed", payload)
	} else {
		_ = publisher.PublishJSON(ctx, "analysis.completed", payload)
	}
	return nil
}

func eventPayload(job *storage.AnalysisJobDetail, status string, startedAt time.Time, finishedAt *time.Time, errMsg *string) map[string]any {
	payload := map[string]any{
		"job_id":     job.ID.String(),
		"product_id": uuidNullToString(job.ProductID),
		"scanners":   job.Scanners,
		"status":     status,
		"created_at": job.CreatedAt.Format(time.RFC3339),
		"stats": map[string]int{
			"findings_total": job.FindingsTotal,
			"findings_new":   job.FindingsNew,
			"duplicates":     job.DuplicatesTotal,
		},
	}
	if job.CreatedBy.Valid {
		payload["actor"] = job.CreatedBy.UUID.String()
	}
	if startedAt.IsZero() == false {
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
