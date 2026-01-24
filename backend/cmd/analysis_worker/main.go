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
	"lotus-warden/backend/internal/scanners"
	"lotus-warden/backend/internal/sla"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const (
	analysisConsumer = "analysis-worker"
	sbomConsumer     = "sbom-worker" // durable consumer name, но работает внутри того же процесса/контейнера

	// Subject для SBOM индексации. Используем literal, чтобы не зависеть от наличия константы в events.
	sbomIndexRequestedSubject = "sbom.index.requested.v1"

	fetchBatchSize = 1

	fetchMaxWait     = 5 * time.Second
	nakRetryDelay    = 30 * time.Second
	inProgressPeriod = 15 * time.Second

	// Safety: не читаем SBOM бесконечно в память.
	maxSbomBytes = 50 << 20 // 50MB
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
	log.SetFlags(log.LstdFlags | log.Lmicroseconds | log.LUTC)

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

	analysisSub, err := js.PullSubscribe(events.AnalysisJobsSubject, analysisConsumer)
	if err != nil {
		log.Fatalf("failed to subscribe analysis: %v", err)
	}

	// SBOM consumer — если stream/subject не настроен, не валим весь воркер,
	// но пишем громкое предупреждение. Анализ-джобы должны жить даже если SBOM сломан.
	sbomSub, err := js.PullSubscribe(sbomIndexRequestedSubject, sbomConsumer)
	if err != nil {
		log.Printf("WARN: failed to subscribe sbom (%s): %v", sbomIndexRequestedSubject, err)
		log.Printf("WARN: SBOM indexing will NOT run until JetStream stream includes subject 'sbom.>' and consumer can be created.")
		sbomSub = nil
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
		sig := <-sigCh
		log.Printf("signal received: %s, shutting down...", sig.String())
		cancel()
	}()

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		runPullLoop(ctx, "analysis", analysisSub, func(m *nats.Msg) error {
			return handleAnalysisMessage(ctx, m, db, store, publisher, cfg)
		})
	}()

	if sbomSub != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runPullLoop(ctx, "sbom", sbomSub, func(m *nats.Msg) error {
				return handleSbomIndexMessage(ctx, m, db, store)
			})
		}()
	}

	wg.Wait()
	log.Printf("worker stopped")
}

func runPullLoop(ctx context.Context, name string, sub *nats.Subscription, handler func(*nats.Msg) error) {
	for {
		if ctx.Err() != nil {
			return
		}

		msgs, err := sub.Fetch(fetchBatchSize, nats.MaxWait(fetchMaxWait))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) {
				continue
			}
			// transient - keep loop alive
			log.Printf("[%s] fetch error: %v", name, err)
			continue
		}

		for _, msg := range msgs {
			// Heartbeat: сообщаем серверу JetStream что мы ещё работаем, чтобы не словить redelivery по AckWait.
			stopHB := startInProgressHeartbeat(ctx, msg, inProgressPeriod)

			err := handler(msg)

			stopHB()

			// ACK strategy:
			// - success / noop / permanently bad payload -> Ack/Term
			// - transient error -> NakWithDelay (retry)
			switch {
			case err == nil:
				_ = msg.Ack()
			case isPermanent(err):
				log.Printf("[%s] permanent error: %v", name, err)
				_ = msg.Term() // не переотправлять никогда
			default:
				log.Printf("[%s] transient error: %v (nak delay %s)", name, err, nakRetryDelay)
				_ = msg.NakWithDelay(nakRetryDelay)
			}
		}
	}
}

func startInProgressHeartbeat(ctx context.Context, msg *nats.Msg, period time.Duration) func() {
	heartbeatCtx, cancel := context.WithCancel(ctx)
	ticker := time.NewTicker(period)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-heartbeatCtx.Done():
				return
			case <-ticker.C:
				// InProgress предотвращает redelivery пока мы делаем длинную работу.
				_ = msg.InProgress()
			}
		}
	}()

	return cancel
}

/* ---------------------------
   ANALYSIS PIPELINE (as-is, но с нормальными ACK)
--------------------------- */

func handleAnalysisMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, store objectstore.Store, publisher *events.Publisher, cfg config.Config) error {
	var payload analysisMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return permanent(fmt.Errorf("invalid analysis payload: %w", err))
	}

	jobID, err := uuid.Parse(payload.JobID)
	if err != nil {
		return permanent(fmt.Errorf("invalid job_id: %w", err))
	}

	job, err := storage.GetAnalysisJobByID(ctx, db, jobID)
	if err != nil {
		return err
	}
	if job == nil {
		// задачи нет — смысла ретраить нет
		return permanent(fmt.Errorf("analysis job not found: %s", jobID.String()))
	}
	if job.Status != models.AnalysisJobQueued {
		// уже обработано/в процессе/не нужно — Ack
		return nil
	}

	startedAt := time.Now().UTC()
	if err := storage.UpdateAnalysisJobStatus(ctx, db, jobID, models.AnalysisJobProcessing, &startedAt, nil, nil); err != nil {
		return err
	}
	_ = publisher.PublishJSON(ctx, "analysis.started", buildEventPayload(job, models.AnalysisJobProcessing, startedAt, nil, nil))

	archiveKey := job.ArchiveKey
	if !archiveKey.Valid || archiveKey.String == "" {
		return finalizeJob(ctx, db, publisher, job, models.AnalysisJobFailed, startedAt, permanent(fmt.Errorf("archive key missing")))
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
	slaMatrix := sla.MatrixFromConfig(cfg)

	var totalNew, totalDuplicates, totalFindings int
	var scanErrors []string

	for _, scanner := range job.Scanners {
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

func runScanner(ctx context.Context, db *sql.DB, store objectstore.Store, publisher *events.Publisher, job *storage.AnalysisJobDetail, scanner string, jobDir string, workspace string, slaMatrix sla.Matrix, cfg scanners.RunnerConfig) (*importing.ImportResult, error) {
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
				SLAMatrix:    slaMatrix,
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

/* ---------------------------
   SBOM INDEXING (MVP внутри analysis-worker)
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

	// 1) получаем object_key и формат из БД
	var objectKey string
	var format string
	err = db.QueryRowContext(ctx, `
		SELECT object_key, format
		FROM sboms
		WHERE id = $1
	`, sbomID).Scan(&objectKey, &format)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return permanent(fmt.Errorf("sbom not found: %s", sbomID.String()))
		}
		return err
	}
	if strings.TrimSpace(objectKey) == "" {
		return permanent(fmt.Errorf("sbom object_key is empty for %s", sbomID.String()))
	}

	// 2) помечаем processing
	_ = updateSbomIndexStatus(ctx, db, sbomID, "processing", nil, nil, nil)

	// 3) читаем объект из MinIO
	reader, err := store.GetObject(ctx, objectKey)
	if err != nil {
		// transient (minio/network)
		return err
	}
	defer reader.Close()

	limited := io.LimitReader(reader, maxSbomBytes+1)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return err
	}
	if int64(len(raw)) > maxSbomBytes {
		// permanent: слишком большой для MVP
		perr := permanent(fmt.Errorf("sbom too large (> %d bytes)", maxSbomBytes))
		_ = updateSbomIndexStatus(ctx, db, sbomID, "failed", ptrString(perr.Error()), ptrInt(0), ptrTime(time.Now().UTC()))
		return perr
	}

	// 4) парсим CycloneDX JSON (MVP)
	// Если у тебя ещё SPDX — можно добавить второй парсер аналогично.
	componentRows, err := parseCycloneDxComponents(raw)
	if err != nil {
		perr := permanent(fmt.Errorf("sbom parse failed: %w", err))
		_ = updateSbomIndexStatus(ctx, db, sbomID, "failed", ptrString(perr.Error()), ptrInt(0), ptrTime(time.Now().UTC()))
		return perr
	}

	// 5) persist components (если таблица есть), и обновляем счётчики
	componentCount := len(componentRows)

	if ok, err := tableExists(ctx, db, "sbom_components"); err != nil {
		return err
	} else if ok {
		if err := persistSbomComponents(ctx, db, sbomID, componentRows); err != nil {
			// если схема не совпала — лучше явно показать failed, чтобы это было видно в UI
			perr := permanent(fmt.Errorf("persist sbom_components failed: %w", err))
			_ = updateSbomIndexStatus(ctx, db, sbomID, "failed", ptrString(perr.Error()), ptrInt(0), ptrTime(time.Now().UTC()))
			return perr
		}
	} else {
		// Таблицы нет — всё равно обновим component_count, чтобы UI видел прогресс.
		log.Printf("[sbom] table sbom_components not found; only updating sboms.component_count/status")
	}

	now := time.Now().UTC()
	_ = updateSbomIndexStatus(ctx, db, sbomID, "done", nil, &componentCount, &now)

	return nil
}

type sbomComponentRow struct {
	PURL     *string
	Name     string
	Version  *string
	Ecosys   *string
	Supplier *string
	Licenses json.RawMessage // JSON array
	Direct   bool
	BomRef   *string
}

type cdxBOM struct {
	BomFormat    string           `json:"bomFormat"`
	SpecVersion  string           `json:"specVersion"`
	Metadata     *cdxMetadata     `json:"metadata"`
	Components   []cdxComponent   `json:"components"`
	Dependencies []cdxDependency  `json:"dependencies"`
}

type cdxMetadata struct {
	Component *cdxComponent `json:"component"`
}

type cdxComponent struct {
	BomRef   string          `json:"bom-ref"`
	Name     string          `json:"name"`
	Version  string          `json:"version"`
	PURL     string          `json:"purl"`
	Supplier *cdxSupplier    `json:"supplier"`
	Licenses []cdxLicenseAny `json:"licenses"`
}

type cdxSupplier struct {
	Name string `json:"name"`
}

type cdxLicenseAny struct {
	License    *cdxLicense `json:"license"`
	Expression string      `json:"expression"`
}

type cdxLicense struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type cdxDependency struct {
	Ref       string   `json:"ref"`
	DependsOn []string `json:"dependsOn"`
}

func parseCycloneDxComponents(raw []byte) ([]sbomComponentRow, error) {
	var bom cdxBOM
	if err := json.Unmarshal(raw, &bom); err != nil {
		return nil, err
	}

	// очень грубая проверка формата
	if strings.ToLower(strings.TrimSpace(bom.BomFormat)) != "cyclonedx" && bom.SpecVersion == "" && len(bom.Components) == 0 {
		// Может быть всё равно CycloneDX, но без bomFormat — не ломаем.
	}

	// rootRef для определения direct deps
	rootRef := ""
	if bom.Metadata != nil && bom.Metadata.Component != nil {
		rootRef = componentRef(*bom.Metadata.Component)
	}

	// direct refs = dependencies[root].dependsOn
	directSet := map[string]struct{}{}
	if rootRef != "" {
		for _, d := range bom.Dependencies {
			if strings.TrimSpace(d.Ref) == rootRef {
				for _, ref := range d.DependsOn {
					ref = strings.TrimSpace(ref)
					if ref != "" {
						directSet[ref] = struct{}{}
					}
				}
				break
			}
		}
	}

	rows := make([]sbomComponentRow, 0, len(bom.Components))
	for _, c := range bom.Components {
		name := strings.TrimSpace(c.Name)
		if name == "" {
			continue
		}

		ref := componentRef(c)
		_, isDirect := directSet[ref]

		var purlPtr *string
		if strings.TrimSpace(c.PURL) != "" {
			p := strings.TrimSpace(c.PURL)
			purlPtr = &p
		}

		var versionPtr *string
		if strings.TrimSpace(c.Version) != "" {
			v := strings.TrimSpace(c.Version)
			versionPtr = &v
		}

		var ecoPtr *string
		if purlPtr != nil {
			if eco := ecosystemFromPurl(*purlPtr); eco != "" {
				ecoPtr = &eco
			}
		}

		var supplierPtr *string
		if c.Supplier != nil && strings.TrimSpace(c.Supplier.Name) != "" {
			s := strings.TrimSpace(c.Supplier.Name)
			supplierPtr = &s
		}

		licenses := extractCycloneDxLicenses(c.Licenses)

		var bomRefPtr *string
		if strings.TrimSpace(c.BomRef) != "" {
			br := strings.TrimSpace(c.BomRef)
			bomRefPtr = &br
		} else if purlPtr != nil {
			// часто рекомендуют PURL как bom-ref
			br := *purlPtr
			bomRefPtr = &br
		}

		rows = append(rows, sbomComponentRow{
			PURL:     purlPtr,
			Name:     name,
			Version:  versionPtr,
			Ecosys:   ecoPtr,
			Supplier: supplierPtr,
			Licenses: licenses,
			Direct:   isDirect,
			BomRef:   bomRefPtr,
		})
	}

	return rows, nil
}

func componentRef(c cdxComponent) string {
	if strings.TrimSpace(c.BomRef) != "" {
		return strings.TrimSpace(c.BomRef)
	}
	if strings.TrimSpace(c.PURL) != "" {
		return strings.TrimSpace(c.PURL)
	}
	// fallback
	n := strings.TrimSpace(c.Name)
	v := strings.TrimSpace(c.Version)
	if n == "" && v == "" {
		return ""
	}
	if v == "" {
		return n
	}
	return n + "@" + v
}

func extractCycloneDxLicenses(items []cdxLicenseAny) json.RawMessage {
	out := make([]string, 0, len(items))
	for _, it := range items {
		if strings.TrimSpace(it.Expression) != "" {
			out = append(out, strings.TrimSpace(it.Expression))
			continue
		}
		if it.License != nil {
			if strings.TrimSpace(it.License.ID) != "" {
				out = append(out, strings.TrimSpace(it.License.ID))
			} else if strings.TrimSpace(it.License.Name) != "" {
				out = append(out, strings.TrimSpace(it.License.Name))
			}
		}
	}
	if len(out) == 0 {
		return json.RawMessage(`[]`)
	}
	b, _ := json.Marshal(out)
	return json.RawMessage(b)
}

func ecosystemFromPurl(purl string) string {
	// purl: "pkg:npm/%40scope/name@1.2.3" => npm
	p := strings.TrimSpace(purl)
	if !strings.HasPrefix(p, "pkg:") {
		return ""
	}
	p = strings.TrimPrefix(p, "pkg:")
	// split by '/'
	slash := strings.IndexByte(p, '/')
	if slash <= 0 {
		// could be "pkg:maven@..." (rare), try split by '@'
		at := strings.IndexByte(p, '@')
		if at <= 0 {
			return ""
		}
		return p[:at]
	}
	return p[:slash]
}

func tableExists(ctx context.Context, db *sql.DB, table string) (bool, error) {
	// PostgreSQL-specific: to_regclass returns null if not exists
	var reg sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT to_regclass($1)`, "public."+table).Scan(&reg); err != nil {
		return false, err
	}
	return reg.Valid && reg.String != "", nil
}

func persistSbomComponents(ctx context.Context, db *sql.DB, sbomID uuid.UUID, rows []sbomComponentRow) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// идемпотентность: пересоздаём с нуля для конкретного sbom_id
	if _, err := tx.ExecContext(ctx, `DELETE FROM sbom_components WHERE sbom_id = $1`, sbomID); err != nil {
		return err
	}

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO sbom_components
			(sbom_id, purl, name, version, ecosystem, supplier, licenses, direct, bom_ref)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, r := range rows {
		if _, err := stmt.ExecContext(
			ctx,
			sbomID,
			r.PURL,
			r.Name,
			r.Version,
			r.Ecosys,
			r.Supplier,
			r.Licenses,
			r.Direct,
			r.BomRef,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func updateSbomIndexStatus(ctx context.Context, db *sql.DB, sbomID uuid.UUID, status string, errMsg *string, componentCount *int, indexedAt *time.Time) error {
	// Поддерживаем частичный апдейт полей через COALESCE,
	// чтобы не затирать значения когда не переданы.
	_, err := db.ExecContext(ctx, `
		UPDATE sboms
		SET
			index_status    = $2,
			index_error     = COALESCE($3, index_error),
			component_count = COALESCE($4, component_count),
			indexed_at      = COALESCE($5, indexed_at)
		WHERE id = $1
	`, sbomID, status, errMsg, componentCount, indexedAt)
	return err
}

/* ---------------------------
   HELPERS (как было)
--------------------------- */

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

func ptrString(s string) *string { return &s }
func ptrInt(i int) *int          { return &i }
func ptrTime(t time.Time) *time.Time {
	return &t
}
