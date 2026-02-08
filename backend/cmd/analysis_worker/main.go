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
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"lotus-warden/backend/internal/archive"
	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/importing"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/sbomindex"
	"lotus-warden/backend/internal/scanners"
	"lotus-warden/backend/internal/sla"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const (
	analysisConsumer = "analysis-worker"
	sbomConsumer     = "sbom-worker" // durable consumer name, но работает внутри того же процесса/контейнера
	riskConsumer     = "risk-worker"
	riskScheduler    = "risk-scheduler"

	fetchBatchSize = 1

	fetchMaxWait     = 5 * time.Second
	nakRetryDelay    = 30 * time.Second
	inProgressPeriod = 15 * time.Second

	riskSchedulerAckWait = 2 * time.Minute
)

type analysisMessage struct {
	JobID string `json:"job_id"`
}

type sbomIndexMessage struct {
	SbomID string `json:"sbom_id"`
	// Можно расширять без breaking changes:
	// ProductID string `json:"product_id,omitempty"`
	// ObjectKey string `json:"object_key,omitempty"`
}

type riskRecomputeMessage struct {
	TenantID  *string `json:"tenant_id,omitempty"`
	FindingID string  `json:"finding_id"`
	Source    string  `json:"source"`
	Cause     string  `json:"cause,omitempty"`
}

type permanentError struct{ err error }

func (e permanentError) Error() string { return e.err.Error() }
func (e permanentError) Unwrap() error { return e.err }

func permanent(err error) error {
	if err == nil {
		return nil
	}
	return permanentError{err: err}
}

func isPermanent(err error) bool {
	var pe permanentError
	return errors.As(err, &pe)
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

	roles := parseWorkerRoles(os.Getenv("WORKER_ROLES"))
	var analysisSub *nats.Subscription
	if roles.has("analysis") {
		analysisSub, err = js.PullSubscribe(
			events.AnalysisJobsSubject,
			analysisConsumer,
			nats.BindStream(events.AnalysisStreamName),
			nats.MaxAckPending(32),
			nats.AckExplicit(),
		)
		if err != nil {
			log.Fatalf("failed to subscribe analysis: %v", err)
		}
	}

	// SBOM consumer — если stream/subject не настроен, не валим весь воркер,
	// но пишем громкое предупреждение. Анализ-джобы должны жить даже если SBOM сломан.
	var sbomSub *nats.Subscription
	if roles.has("sbom") {
		sbomSub, err = js.PullSubscribe(
			events.SbomIndexRequestedSubject,
			sbomConsumer,
			nats.BindStream(events.SbomStreamName),
			nats.MaxAckPending(32),
			nats.AckExplicit(),
		)
		if err != nil {
			log.Printf("WARN: failed to subscribe sbom (%s): %v", events.SbomIndexRequestedSubject, err)
			log.Printf("WARN: SBOM indexing will NOT run until JetStream stream includes subject 'sbom.>' and consumer can be created.")
			sbomSub = nil
		}
	}

	var riskSub *nats.Subscription
	if roles.hasAny("risk_compute", "risk") {
		riskSub, err = js.PullSubscribe(
			events.RiskRecomputeRequestedSubject,
			riskConsumer,
			nats.BindStream(events.AnalysisStreamName),
			nats.MaxAckPending(64),
			nats.AckExplicit(),
		)
		if err != nil {
			log.Fatalf("failed to subscribe risk: %v", err)
		}
	}

	var intelEPSSSub *nats.Subscription
	var intelKEVSub *nats.Subscription
	var intelNVDSub *nats.Subscription
	var assetContextSub *nats.Subscription
	var riskModelSub *nats.Subscription
	if roles.has("risk_scheduler") {
		intelEPSSSub, err = js.PullSubscribe(
			events.IntelEPSSRefreshedSubject,
			"risk-scheduler-epss",
			nats.BindStream(events.IntelStreamName),
			nats.MaxAckPending(16),
			nats.AckExplicit(),
			nats.AckWait(riskSchedulerAckWait),
		)
		if err != nil {
			log.Fatalf("failed to subscribe intel epss: %v", err)
		}
		intelKEVSub, err = js.PullSubscribe(
			events.IntelKEVRefreshedSubject,
			"risk-scheduler-kev",
			nats.BindStream(events.IntelStreamName),
			nats.MaxAckPending(16),
			nats.AckExplicit(),
			nats.AckWait(riskSchedulerAckWait),
		)
		if err != nil {
			log.Fatalf("failed to subscribe intel kev: %v", err)
		}
		intelNVDSub, err = js.PullSubscribe(
			events.IntelNVDRefreshedSubject,
			"risk-scheduler-nvd",
			nats.BindStream(events.IntelStreamName),
			nats.MaxAckPending(16),
			nats.AckExplicit(),
			nats.AckWait(riskSchedulerAckWait),
		)
		if err != nil {
			log.Fatalf("failed to subscribe intel nvd: %v", err)
		}
		assetContextSub, err = js.PullSubscribe(
			events.AssetContextUpdatedSubject,
			"risk-scheduler-asset-context",
			nats.BindStream(events.AnalysisStreamName),
			nats.MaxAckPending(32),
			nats.AckExplicit(),
			nats.AckWait(riskSchedulerAckWait),
		)
		if err != nil {
			log.Fatalf("failed to subscribe asset context: %v", err)
		}
		riskModelSub, err = js.PullSubscribe(
			events.RiskModelActivatedSubject,
			"risk-scheduler-model",
			nats.BindStream(events.AnalysisStreamName),
			nats.MaxAckPending(8),
			nats.AckExplicit(),
			nats.AckWait(riskSchedulerAckWait),
		)
		if err != nil {
			log.Fatalf("failed to subscribe risk model: %v", err)
		}
	}

	// cleanup (как было)
	cleanupInterval := parseDuration(cfg.AnalysisCleanupInterval, time.Hour)
	cleanupTTL := parseDuration(cfg.AnalysisCleanupTTL, 24*time.Hour)
	analysisTempDir := cfg.AnalysisTempDir
	if err := os.MkdirAll(analysisTempDir, 0o750); err != nil {
		log.Fatalf("failed to init temp dir: %v", err)
	}
	go periodicCleanup(db, store, analysisTempDir, cleanupTTL, cleanupInterval)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// graceful shutdown
	sigCh := make(chan os.Signal, 2)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		s := <-sigCh
		log.Printf("shutdown signal: %v", s)
		cancel()
	}()

	var wg sync.WaitGroup

	// Анализ-джобы
	if analysisSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "analysis", analysisSub, func(c context.Context, m *nats.Msg) error {
				return handleAnalysisMessage(c, m, db, store, publisher, cfg)
			})
		}()
	}

	// SBOM индексация (если подписка поднялась)
	if sbomSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "sbom", sbomSub, func(c context.Context, m *nats.Msg) error {
				return handleSbomIndexMessage(c, m, db, store)
			})
		}()
	}

	if riskSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "risk", riskSub, func(c context.Context, m *nats.Msg) error {
				return handleRiskMessage(c, m, db)
			})
		}()
	}

	if intelEPSSSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "risk-scheduler-epss", intelEPSSSub, func(c context.Context, m *nats.Msg) error {
				return handleIntelRefreshMessage(c, m, db, publisher, events.IntelEPSSRefreshedSubject)
			})
		}()
	}

	if intelKEVSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "risk-scheduler-kev", intelKEVSub, func(c context.Context, m *nats.Msg) error {
				return handleIntelRefreshMessage(c, m, db, publisher, events.IntelKEVRefreshedSubject)
			})
		}()
	}

	if intelNVDSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "risk-scheduler-nvd", intelNVDSub, func(c context.Context, m *nats.Msg) error {
				return handleIntelRefreshMessage(c, m, db, publisher, events.IntelNVDRefreshedSubject)
			})
		}()
	}

	if assetContextSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "risk-scheduler-asset-context", assetContextSub, func(c context.Context, m *nats.Msg) error {
				return handleAssetContextMessage(c, m, db, publisher)
			})
		}()
	}

	if riskModelSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "risk-scheduler-model", riskModelSub, func(c context.Context, m *nats.Msg) error {
				return handleRiskModelActivatedMessage(c, m, db, publisher)
			})
		}()
	}

	wg.Wait()
	log.Printf("analysis-worker stopped")
}

func runPullLoop(ctx context.Context, name string, sub *nats.Subscription, handler func(context.Context, *nats.Msg) error) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		msgs, err := sub.Fetch(fetchBatchSize, nats.MaxWait(fetchMaxWait))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) {
				continue
			}
			log.Printf("[%s] fetch error: %v", name, err)
			continue
		}

		for _, msg := range msgs {
			if msg == nil {
				continue
			}

			// обработка в отдельном контексте (чтобы можно было отменить)
			err := handler(ctx, msg)
			if err == nil {
				_ = msg.Ack()
				continue
			}

			if isPermanent(err) {
				// Бессмысленно ретраить — снимаем сообщение навсегда (Term).
				log.Printf("[%s] permanent error, term msg: %v", name, err)
				_ = msg.Term()
				continue
			}

			// transient: просим JetStream повторить позже
			log.Printf("[%s] transient error, nak msg: %v", name, err)
			_ = msg.NakWithDelay(nakRetryDelay)
		}
	}
}

type workerRoles map[string]struct{}

func (r workerRoles) has(role string) bool {
	_, ok := r[role]
	return ok
}

func (r workerRoles) hasAny(roles ...string) bool {
	for _, role := range roles {
		if r.has(role) {
			return true
		}
	}
	return false
}

func parseWorkerRoles(raw string) workerRoles {
	roles := workerRoles{}
	clean := strings.TrimSpace(raw)
	if clean == "" {
		roles["analysis"] = struct{}{}
		roles["sbom"] = struct{}{}
		roles["risk_compute"] = struct{}{}
		roles["risk_scheduler"] = struct{}{}
		return roles
	}
	for _, part := range strings.FieldsFunc(clean, func(r rune) bool { return r == ',' || r == ';' || r == ' ' }) {
		value := strings.TrimSpace(strings.ToLower(part))
		if value == "" {
			continue
		}
		roles[value] = struct{}{}
	}
	return roles
}

/* ---------------------------
   ANALYSIS JOBS
--------------------------- */

func handleAnalysisMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, store objectstore.Store, publisher *events.Publisher, cfg config.Config) error {
	var payload analysisMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return permanent(fmt.Errorf("invalid payload: %w", err))
	}

	jobID, err := uuid.Parse(payload.JobID)
	if err != nil {
		return permanent(fmt.Errorf("invalid job_id: %w", err))
	}

	job, err := storage.GetAnalysisJobByID(ctx, db, jobID)
	if err != nil || job == nil {
		if err == nil {
			err = fmt.Errorf("job not found: %s", jobID.String())
		}
		return permanent(err)
	}

	if job.Status != models.AnalysisJobQueued {
		return nil
	}

	startedAt := time.Now().UTC()
	if err := storage.UpdateAnalysisJobStatus(ctx, db, jobID, models.AnalysisJobProcessing, &startedAt, nil, nil); err != nil {
		return err
	}
	_ = publisher.PublishJSON(ctx, "analysis.started", buildEventPayload(job, models.AnalysisJobProcessing, startedAt, nil, nil))

	sourceKind := strings.ToLower(strings.TrimSpace(job.SourceKind))
	if sourceKind == "" {
		if job.SourceSnapshotID.Valid {
			sourceKind = models.AnalysisJobSourceSnapshot
		} else {
			sourceKind = models.AnalysisJobSourceEphemeral
		}
	}

	archiveKey := job.ArchiveKey
	sourceType := sourceKind
	if sourceKind == models.AnalysisJobSourceSnapshot {
		if !job.SourceSnapshotID.Valid {
			return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, fmt.Errorf("source snapshot missing"))
		}
		snapshot, err := storage.GetProductSourceSnapshotByID(ctx, db, job.SourceSnapshotID.UUID)
		if err != nil {
			return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
		}
		if snapshot == nil || snapshot.ObjectKey == "" {
			return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, fmt.Errorf("source snapshot missing"))
		}
		archiveKey = sql.NullString{String: snapshot.ObjectKey, Valid: true}
	}
	if !archiveKey.Valid || archiveKey.String == "" {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, fmt.Errorf("archive key missing"))
	}
	productID := ""
	if job.ProductID.Valid {
		productID = job.ProductID.UUID.String()
	}
	tenantID := ""
	if job.TenantID.Valid {
		tenantID = job.TenantID.UUID.String()
	}
	log.Printf("analysis job processing job_id=%s tenant_id=%s product_id=%s source=%s", job.ID.String(), tenantID, productID, sourceType)

	jobDir := filepath.Join(cfg.AnalysisTempDir, jobID.String())
	archivePath := archivePathForKey(jobDir, archiveKey.String)
	workspace := filepath.Join(jobDir, "src")

	if err := os.MkdirAll(jobDir, 0o750); err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
	}
	defer os.RemoveAll(jobDir)

	if err := downloadArchive(ctx, store, archiveKey.String, archivePath); err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
	}

	format, err := archive.DetectArchiveFormatFromPath(archivePath)
	if err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, err)
	}
	log.Printf("analysis job archive job_id=%s tenant_id=%s product_id=%s source=%s archive_format=%s",
		job.ID.String(), tenantID, productID, sourceType, format.String())

	if !isSupportedArchiveFormat(format) {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, fmt.Errorf("Неподдерживаемый формат архива. Поддерживаются: zip, tar.gz, tgz."))
	}

	maxExtract := parseInt64(cfg.AnalysisMaxExtractBytes, 524288000)
	if err := archive.ExtractWithFormat(archivePath, workspace, maxExtract, format); err != nil {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, wrapArchiveExtractionError(format, err))
	}

	scannerCfg := scanners.RunnerConfig{
		ContainerNetwork: cfg.AnalysisContainerNetwork,
		OpenGrepImage:    cfg.AnalysisOpenGrepImage,
		TrivyImage:       cfg.AnalysisTrivyImage,
		CheckovImage:     cfg.AnalysisCheckovImage,
		KICSImage:        cfg.AnalysisKICSImage,
		GitleaksImage:    cfg.AnalysisGitleaksImage,
		GrypeImage:       cfg.AnalysisGrypeImage,
		Timeout:          parseDuration(cfg.AnalysisScannerTimeout, 20*time.Minute),
	}
	slaMatrix := sla.MatrixFromConfig(cfg)

	var totalNew, totalDuplicates, totalFindings int
	var scanErrors []string

	for _, scanner := range job.Scanners {
		// периодически продлеваем ack deadline (если JetStream настроен на AckExplicit)
		_ = msg.InProgress()

		scanner = strings.ToLower(strings.TrimSpace(scanner))
		result, err := runScanner(ctx, db, store, publisher, job, scanner, jobDir, workspace, slaMatrix, scannerCfg)
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

	if sourceKind == models.AnalysisJobSourceEphemeral {
		if err := store.DeleteObject(ctx, archiveKey.String); err != nil {
			scanErrors = append(scanErrors, fmt.Sprintf("failed to delete archive: %v", err))
		} else {
			_ = storage.UpdateAnalysisJobArchiveKey(ctx, db, job.ID, nil, 0)
		}
	}

	status := models.AnalysisJobSucceeded
	var finalErr error
	if len(scanErrors) > 0 {
		status = models.AnalysisJobFailed
		finalErr = errors.New(strings.Join(scanErrors, "; "))
	}

	return finalizeJob(ctx, db, publisher, job, status, startedAt, finalErr)
}

func runScanner(ctx context.Context, db *sql.DB, store objectstore.Store, publisher *events.Publisher, job *storage.AnalysisJobDetail, scanner string, jobDir string, workspace string, slaMatrix sla.Matrix, cfg scanners.RunnerConfig) (*importing.ImportResult, error) {
	resultPath := filepath.Join(jobDir, fmt.Sprintf("result_%s.json", scanner))

	scannerStartedAt := time.Now().UTC()
	// Track in new analysis_job_scanners table
	_ = storage.UpdateAnalysisJobScannerStatus(ctx, db, job.ID, scanner, "running", nil, nil, nil, &scannerStartedAt, nil, nil)

	var scanErr error
	switch scanner {
	case "opengrep":
		scanErr = scanners.RunOpenGrep(ctx, cfg, workspace, resultPath)
	case "trivy":
		scanErr = scanners.RunTrivy(ctx, cfg, workspace, resultPath)
	case "checkov":
		scanErr = scanners.RunCheckov(ctx, cfg, workspace, resultPath)
	case "kics":
		scanErr = scanners.RunKICS(ctx, cfg, workspace, resultPath)
	case "gitleaks":
		scanErr = scanners.RunGitleaks(ctx, cfg, workspace, resultPath)
	case "grype":
		scanErr = scanners.RunGrype(ctx, cfg, workspace, resultPath)
	default:
		errMsg := fmt.Sprintf("unsupported scanner: %s", scanner)
		finNow := time.Now().UTC()
		_ = storage.UpdateAnalysisJobScannerStatus(ctx, db, job.ID, scanner, models.AnalysisScannerFailed, nil, nil, &errMsg, nil, &finNow, nil)
		return nil, permanent(fmt.Errorf("%s", errMsg))
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

	// Import findings — for opengrep, use "opengrep" as scanner name so the alias plugin picks it up
	importScanner := scanner
	var importJobID *uuid.UUID
	var importResult *importing.ImportResult
	var importErr error

	if artifactUploaded {
		if bytes, err := os.ReadFile(resultPath); err == nil {
			importResult, importErr = importing.ImportFindings(ctx, db, importing.ImportParams{
				Scanner:      importScanner,
				Report:       bytes,
				SourceType:   "scanner",
				ProductID:    importing.NullUUIDPtr(job.ProductID),
				EngagementID: importing.NullUUIDPtr(job.EngagementID),
				CreatedBy:    importing.NullUUIDPtr(job.CreatedBy),
				TenantID:     importing.NullUUIDPtr(job.TenantID),
				SLAMatrix:    slaMatrix,
				Callbacks: &importing.ImportCallbacks{
					OnFindingCreated: func(finding *models.Finding) {
						publishRiskRecompute(ctx, publisher, finding.ID, finding.TenantID, "import")
					},
					OnDuplicateCreated: func(_ *models.Finding, masterID uuid.UUID) {
						publishRiskRecompute(ctx, publisher, masterID, importing.NullUUIDPtr(job.TenantID), "import")
					},
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

	// Update legacy per-scanner columns (backward compat)
	if err := storage.UpdateAnalysisJobScanner(ctx, db, job.ID, scanner, status, importJobID, artifactKeyPtr); err != nil {
		return importResult, err
	}

	// Update new analysis_job_scanners table
	scannerFinishedAt := time.Now().UTC()
	durationMs := int(scannerFinishedAt.Sub(scannerStartedAt).Milliseconds())
	var scanErrMsg *string
	if scanErr != nil {
		msg := scanErr.Error()
		scanErrMsg = &msg
	} else if importErr != nil {
		msg := importErr.Error()
		scanErrMsg = &msg
	}
	_ = storage.UpdateAnalysisJobScannerStatus(ctx, db, job.ID, scanner, status, artifactKeyPtr, importJobID, scanErrMsg, nil, &scannerFinishedAt, &durationMs)

	if scanErr != nil {
		return importResult, scanErr
	}
	if importErr != nil {
		return importResult, importErr
	}
	return importResult, nil
}

/* ---------------------------
   SBOM INDEXING (без отдельного контейнера)
   - слушаем events.SbomIndexRequestedSubject
   - вызываем internal/sbomindex.IndexSbom
   - статус/ошибки пишутся в sboms.index_status/index_error самим indexer'ом
--------------------------- */

func handleSbomIndexMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, store objectstore.Store) error {
	var payload sbomIndexMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return permanent(fmt.Errorf("invalid sbom payload: %w", err))
	}

	sbomID, err := uuid.Parse(payload.SbomID)
	if err != nil {
		return permanent(fmt.Errorf("invalid sbom_id: %w", err))
	}

	start := time.Now()
	log.Printf("[sbom] index start sbom_id=%s", sbomID.String())

	err = sbomindex.IndexSbom(ctx, db, store, sbomID)
	duration := time.Since(start)

	// best-effort: для логов подтянем текущий статус/счётчики
	sbom, sbomErr := storage.GetSbomByID(ctx, db, sbomID)
	status := "unknown"
	componentCount := 0
	edgeCount := 0
	if sbomErr == nil && sbom != nil {
		status = sbom.IndexStatus
		componentCount = sbom.ComponentCount
		edgeCount = sbom.EdgeCount
	}

	if err != nil {
		log.Printf("[sbom] index failed sbom_id=%s status=%s components=%d edges=%d duration=%s err=%v",
			sbomID.String(), status, componentCount, edgeCount, duration, err)

		// Парс/формат/схема — бессмысленно ретраить.
		if isLikelyPermanentSbomError(err) {
			return permanent(err)
		}
		return err
	}

	log.Printf("[sbom] index done sbom_id=%s status=%s components=%d edges=%d duration=%s",
		sbomID.String(), status, componentCount, edgeCount, duration)

	return nil
}

func isLikelyPermanentSbomError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())

	// Not found / format / parse issues
	if strings.Contains(msg, "sbom not found") ||
		strings.Contains(msg, "unsupported sbom format") ||
		strings.Contains(msg, "invalid cyclonedx") ||
		strings.Contains(msg, "spdx tag-value") {
		return true
	}

	// Schema mismatch (undefined table/column)
	if strings.Contains(msg, "does not exist") ||
		strings.Contains(msg, "undefined_column") ||
		strings.Contains(msg, "undefined_table") {
		return true
	}

	return false
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
	if job.SourceSnapshotID.Valid {
		payload["source_snapshot_id"] = job.SourceSnapshotID.UUID.String()
	}
	return payload
}

func archivePathForKey(jobDir string, key string) string {
	filename := "archive"
	lowerKey := strings.ToLower(strings.TrimSpace(key))
	if strings.HasSuffix(lowerKey, ".tar.gz") {
		filename += ".tar.gz"
	} else if strings.HasSuffix(lowerKey, ".tgz") {
		filename += ".tar.gz"
	} else if strings.HasSuffix(lowerKey, ".zip") {
		filename += ".zip"
	} else if strings.HasSuffix(lowerKey, ".tar") {
		filename += ".tar"
	}
	return filepath.Join(jobDir, filename)
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
		if job.SourceSnapshotID.Valid || !job.ArchiveKey.Valid {
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

func isSupportedArchiveFormat(format archive.ArchiveFormat) bool {
	return format == archive.ArchiveFormatZip || format == archive.ArchiveFormatTarGz
}

func wrapArchiveExtractionError(format archive.ArchiveFormat, err error) error {
	if err == nil {
		return nil
	}
	if format == archive.ArchiveFormatTarGz {
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "gzip") || strings.Contains(msg, "invalid header") {
			return fmt.Errorf("Архив не является gzip/tar.gz. Возможно, вы загрузили ZIP. Поддерживаются: zip, tar.gz, tgz.")
		}
	}
	return err
}
