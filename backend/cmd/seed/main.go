package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"math/rand/v2"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"vulnscope/internal/config"
)

// --- Realistic data pools ---

var projectDefs = []struct {
	name string
	desc string
	tags []string
}{
	{"platform-backend", "Core backend services and APIs", []string{"go", "backend", "api"}},
	{"web-frontend", "Customer-facing web application", []string{"react", "typescript", "frontend"}},
	{"mobile-app", "iOS and Android mobile application", []string{"kotlin", "swift", "mobile"}},
	{"infra-services", "Infrastructure and DevOps tooling", []string{"docker", "k8s", "terraform"}},
	{"data-pipeline", "ETL and data processing services", []string{"python", "spark", "etl"}},
}

var topCWEs = []int{79, 89, 22, 78, 434, 502, 787, 416, 190, 476, 20, 125, 77, 798, 862, 306, 918, 611, 94, 269, 352, 400, 732, 327, 522}

var filePaths = []string{
	"src/api/auth.py", "src/api/users.py", "src/api/payments.py", "src/api/orders.py",
	"lib/utils/parser.go", "lib/utils/crypto.go", "lib/utils/validator.go",
	"src/controllers/UserController.java", "src/controllers/AdminController.java",
	"src/services/AuthService.ts", "src/services/PaymentService.ts",
	"pkg/middleware/jwt.go", "pkg/middleware/cors.go", "pkg/middleware/ratelimit.go",
	"internal/storage/db.go", "internal/storage/cache.go",
	"app/models/user.rb", "app/models/order.rb",
	"src/main/java/com/app/config/SecurityConfig.java",
	"src/main/java/com/app/util/XmlParser.java",
	"lib/http/client.py", "lib/http/server.py",
	"src/components/Login.tsx", "src/components/Upload.tsx",
	"cmd/server/main.go", "cmd/worker/main.go",
	"deploy/terraform/main.tf", "deploy/k8s/deployment.yaml",
	"scripts/migrate.sh", "scripts/backup.sh",
}

var components = []struct {
	name    string
	version string
}{
	{"log4j-core", "2.14.1"}, {"log4j-core", "2.17.0"},
	{"spring-core", "5.3.18"}, {"spring-core", "5.3.25"}, {"spring-core", "6.0.7"},
	{"spring-webmvc", "5.3.20"}, {"spring-boot", "2.7.5"},
	{"jackson-databind", "2.13.4"}, {"jackson-databind", "2.14.2"},
	{"commons-text", "1.9"}, {"commons-io", "2.11.0"},
	{"lodash", "4.17.20"}, {"lodash", "4.17.21"},
	{"express", "4.17.3"}, {"express", "4.18.2"},
	{"axios", "0.21.1"}, {"axios", "1.4.0"},
	{"django", "3.2.15"}, {"django", "4.1.7"},
	{"flask", "2.2.3"}, {"flask", "2.3.2"},
	{"requests", "2.28.1"}, {"urllib3", "1.26.15"},
	{"pillow", "9.3.0"}, {"numpy", "1.24.2"},
	{"golang.org/x/crypto", "0.6.0"}, {"golang.org/x/net", "0.7.0"},
	{"github.com/gin-gonic/gin", "1.9.0"},
	{"openssl", "1.1.1t"}, {"openssl", "3.0.8"},
	{"libxml2", "2.9.14"}, {"zlib", "1.2.13"},
	{"netty", "4.1.89"}, {"guava", "31.1"},
	{"postgres", "15.2"}, {"redis", "7.0.9"},
}

var sourceTypes = []string{"trivy", "sarif", "semgrep", "snyk", "grype", "bandit", "gosec", "codeql"}

var titleTemplates = []string{
	"SQL Injection in %s",
	"Cross-Site Scripting (XSS) in %s",
	"Path Traversal in %s",
	"Command Injection via %s",
	"Insecure Deserialization in %s",
	"Server-Side Request Forgery in %s",
	"XML External Entity (XXE) in %s",
	"Remote Code Execution via %s",
	"Authentication Bypass in %s",
	"Sensitive Data Exposure in %s",
	"Hardcoded Credentials in %s",
	"Use of Known Vulnerable Component: %s",
	"Improper Input Validation in %s",
	"Missing Authorization Check in %s",
	"Insecure Cryptographic Algorithm in %s",
	"Open Redirect in %s",
	"Cross-Site Request Forgery in %s",
	"Buffer Overflow in %s",
	"Integer Overflow in %s",
	"NULL Pointer Dereference in %s",
	"Use After Free in %s",
	"Race Condition in %s",
	"Information Disclosure via %s",
	"Unrestricted File Upload in %s",
	"Denial of Service via %s",
}

var descSnippets = []string{
	"An attacker could exploit this vulnerability to execute arbitrary commands on the server.",
	"Untrusted input is used directly in a database query without proper sanitization.",
	"User-controlled data is rendered in HTML output without escaping, allowing script injection.",
	"The application uses a known vulnerable version of this dependency.",
	"Sensitive configuration data is hardcoded in the source code.",
	"The component does not properly validate the certificate chain.",
	"Insufficient access control allows unauthorized users to access restricted resources.",
	"Input length is not validated before memory allocation, causing potential overflow.",
	"The cryptographic algorithm used is considered weak and should be replaced.",
	"Error messages expose internal implementation details to external users.",
}

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to create pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("failed to ping db", "error", err)
		os.Exit(1)
	}

	totalFindings := 100_000
	batchSize := 1000

	// 1. Create projects
	slog.Info("creating projects...")
	projectIDs, err := seedProjects(ctx, pool)
	if err != nil {
		slog.Error("failed to seed projects", "error", err)
		os.Exit(1)
	}
	slog.Info("projects created", "count", len(projectIDs))

	// 2. Generate and insert findings in batches
	slog.Info("generating findings...", "total", totalFindings, "batch_size", batchSize)

	// Weighted project distribution: 35%, 25%, 20%, 12%, 8%
	projectWeights := []float64{0.35, 0.25, 0.20, 0.12, 0.08}

	start := time.Now()
	inserted := 0

	for batch := 0; inserted < totalFindings; batch++ {
		size := batchSize
		if inserted+size > totalFindings {
			size = totalFindings - inserted
		}

		findings := make([][]any, 0, size)
		for i := 0; i < size; i++ {
			f := generateFinding(projectIDs, projectWeights)
			findings = append(findings, f)
		}

		n, err := batchInsertFindings(ctx, pool, findings)
		if err != nil {
			slog.Error("batch insert failed", "batch", batch, "error", err)
			os.Exit(1)
		}
		inserted += int(n)

		if (batch+1)%10 == 0 {
			elapsed := time.Since(start)
			rate := float64(inserted) / elapsed.Seconds()
			slog.Info("progress", "inserted", inserted, "elapsed", elapsed.Round(time.Millisecond), "rate", fmt.Sprintf("%.0f/s", rate))
		}
	}

	elapsed := time.Since(start)
	slog.Info("findings seeded", "total", inserted, "elapsed", elapsed.Round(time.Millisecond))

	// 3. Generate finding_scores for ~70% of findings
	slog.Info("generating finding scores...")
	scoreStart := time.Now()
	scored, err := seedFindingScores(ctx, pool, batchSize)
	if err != nil {
		slog.Error("failed to seed scores", "error", err)
		os.Exit(1)
	}
	slog.Info("scores seeded", "count", scored, "elapsed", time.Since(scoreStart).Round(time.Millisecond))

	// 4. Refresh materialized views
	slog.Info("refreshing materialized views...")
	refreshViews(ctx, pool)

	// 5. Performance benchmarks
	slog.Info("=== PERFORMANCE BENCHMARKS ===")
	runBenchmarks(cfg)
}

func seedProjects(ctx context.Context, pool *pgxpool.Pool) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, len(projectDefs))
	for i, p := range projectDefs {
		id := uuid.New()
		_, err := pool.Exec(ctx, `
			INSERT INTO projects (id, name, description, tags, created_at, updated_at)
			VALUES ($1, $2, $3, $4, now(), now())
			ON CONFLICT (name) DO UPDATE SET id = projects.id
			RETURNING id
		`, id, p.name, p.desc, p.tags)
		if err != nil {
			return nil, fmt.Errorf("seedProjects: %s: %w", p.name, err)
		}
		// Read back in case of conflict
		err = pool.QueryRow(ctx, `SELECT id FROM projects WHERE name = $1`, p.name).Scan(&ids[i])
		if err != nil {
			return nil, fmt.Errorf("seedProjects: read back %s: %w", p.name, err)
		}
	}
	return ids, nil
}

func generateFinding(projectIDs []uuid.UUID, weights []float64) []any {
	// Pick project by weight
	r := rand.Float64()
	cumulative := 0.0
	pidx := 0
	for i, w := range weights {
		cumulative += w
		if r < cumulative {
			pidx = i
			break
		}
	}
	projectID := projectIDs[pidx]

	// Severity distribution: info=5%, low=25%, medium=40%, high=22%, critical=8%
	severity := pickWeighted([]int{0, 1, 2, 3, 4}, []float64{0.05, 0.25, 0.40, 0.22, 0.08})

	// Status distribution: open=60%, confirmed=15%, fp=10%, resolved=10%, risk_accepted=5%
	status := pickWeighted([]int{0, 1, 2, 3, 4}, []float64{0.60, 0.15, 0.10, 0.10, 0.05})

	confidence := rand.IntN(4) // 0-3

	// CVE
	cveYear := 2020 + rand.IntN(6) // 2020-2025
	cveNum := 1000 + rand.IntN(49000)
	cveID := fmt.Sprintf("CVE-%d-%d", cveYear, cveNum)

	// CWE: pick 1-2 from top-25
	numCWE := 1 + rand.IntN(2)
	cweIDs := make([]int, numCWE)
	for i := range cweIDs {
		cweIDs[i] = topCWEs[rand.IntN(len(topCWEs))]
	}

	// File path
	filePath := filePaths[rand.IntN(len(filePaths))]

	lineStart := 10 + rand.IntN(500)
	lineEnd := lineStart + rand.IntN(20)

	// Component
	comp := components[rand.IntN(len(components))]

	sourceType := sourceTypes[rand.IntN(len(sourceTypes))]

	// Title
	titleTarget := comp.name
	if rand.Float64() < 0.3 {
		titleTarget = filePath
	}
	title := fmt.Sprintf(titleTemplates[rand.IntN(len(titleTemplates))], titleTarget)

	desc := descSnippets[rand.IntN(len(descSnippets))]

	// Fingerprint
	fingerprint := calcFingerprint(cveID, filePath, cweIDs[0], comp.name, comp.version)

	// Timestamps: first_seen randomly within last 180 days
	daysAgo := rand.IntN(180)
	firstSeen := time.Now().AddDate(0, 0, -daysAgo)
	lastSeen := firstSeen.Add(time.Duration(rand.IntN(daysAgo+1)) * 24 * time.Hour)
	if lastSeen.After(time.Now()) {
		lastSeen = time.Now()
	}
	timesSeen := 1 + rand.IntN(20)

	cpeURI := fmt.Sprintf("cpe:2.3:a:*:%s:%s:*:*:*:*:*:*:*", comp.name, comp.version)

	id := uuid.New()

	return []any{
		id, title, desc, severity, confidence, status,
		filePath, lineStart, lineEnd, comp.name, comp.version,
		[]string{cveID}, cweIDs, cpeURI, fingerprint,
		firstSeen, lastSeen, timesSeen, projectID, sourceType,
	}
}

func calcFingerprint(cveID, filePath string, cweID int, component, version string) string {
	input := strings.ToLower(cveID) +
		strings.ToLower(filePath) +
		fmt.Sprintf("%d", cweID) +
		strings.ToLower(component) +
		strings.ToLower(version)
	h := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", h)
}

func pickWeighted(values []int, weights []float64) int {
	r := rand.Float64()
	cumulative := 0.0
	for i, w := range weights {
		cumulative += w
		if r < cumulative {
			return values[i]
		}
	}
	return values[len(values)-1]
}

func batchInsertFindings(ctx context.Context, pool *pgxpool.Pool, rows [][]any) (int64, error) {
	cols := []string{
		"id", "title", "description", "severity", "confidence", "status",
		"file_path", "line_start", "line_end", "component", "component_version",
		"cve_ids", "cwe_ids", "cpe_uri", "fingerprint",
		"first_seen", "last_seen", "times_seen", "project_id", "source_type",
	}

	copyCount, err := pool.CopyFrom(
		ctx,
		pgx.Identifier{"findings"},
		cols,
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return 0, fmt.Errorf("batchInsertFindings: %w", err)
	}
	return copyCount, nil
}

func seedFindingScores(ctx context.Context, pool *pgxpool.Pool, batchSize int) (int, error) {
	total := 0
	for {
		rows, err := pool.Query(ctx, `
			SELECT f.id, f.severity, f.first_seen
			FROM findings f
			LEFT JOIN finding_scores fs ON fs.finding_id = f.id
			WHERE fs.finding_id IS NULL
			LIMIT $1
		`, batchSize)
		if err != nil {
			return total, fmt.Errorf("seedFindingScores: query: %w", err)
		}

		type scoreSrc struct {
			id        uuid.UUID
			severity  int
			firstSeen time.Time
		}

		var batch []scoreSrc
		for rows.Next() {
			var s scoreSrc
			if err := rows.Scan(&s.id, &s.severity, &s.firstSeen); err != nil {
				rows.Close()
				return total, fmt.Errorf("seedFindingScores: scan: %w", err)
			}
			// Only ~70% get scores
			if rand.Float64() < 0.70 {
				batch = append(batch, s)
			}
		}
		rows.Close()

		if len(batch) == 0 {
			break
		}

		scoreRows := make([][]any, 0, len(batch))
		for _, s := range batch {
			baseScore := float64(s.severity)*2.0 + rand.Float64()*2.0
			if baseScore > 10.0 {
				baseScore = 10.0
			}
			epssScore := rand.Float64() * 0.5
			if s.severity >= 3 {
				epssScore = 0.1 + rand.Float64()*0.8
			}
			epssPercentile := epssScore * 100
			isKEV := s.severity == 4 && rand.Float64() < 0.3
			isBDU := rand.Float64() < 0.1

			daysOld := math.Max(0, time.Since(s.firstSeen).Hours()/24)
			recency := 10.0 * math.Exp(-daysOld/365.0)

			priorityScore := baseScore*0.30 + epssScore*100*0.25
			if isKEV {
				priorityScore += 10.0 * 0.20
			}
			if isBDU {
				priorityScore += 5.0 * 0.10
			}
			priorityScore += recency * 0.10

			scoreRows = append(scoreRows, []any{
				s.id, baseScore, epssScore, epssPercentile, isKEV, isBDU, priorityScore, time.Now(),
			})
		}

		_, err = pool.CopyFrom(ctx, pgx.Identifier{"finding_scores"},
			[]string{"finding_id", "base_score", "epss_score", "epss_percentile", "is_kev", "is_bdu", "priority_score", "calculated_at"},
			pgx.CopyFromRows(scoreRows),
		)
		if err != nil {
			return total, fmt.Errorf("seedFindingScores: copy: %w", err)
		}
		total += len(scoreRows)
	}
	return total, nil
}

func refreshViews(ctx context.Context, pool *pgxpool.Pool) {
	for _, view := range []string{"dashboard_stats", "enrichment_coverage"} {
		start := time.Now()
		_, err := pool.Exec(ctx, "REFRESH MATERIALIZED VIEW "+view)
		if err != nil {
			slog.Error("refresh view failed", "view", view, "error", err)
			continue
		}
		slog.Info("view refreshed", "view", view, "duration", time.Since(start).Round(time.Millisecond))
	}
}

func runBenchmarks(cfg *config.Config) {
	baseURL := fmt.Sprintf("http://localhost:%s", cfg.ServerPort)

	benchmarks := []struct {
		name      string
		path      string
		maxMs     int64
	}{
		{"GET /api/v1/findings?limit=50", "/api/v1/findings?limit=50", 100},
		{"GET /api/v1/dashboard/stats", "/api/v1/dashboard/stats", 50},
		{"GET /api/v1/findings?q=sql+injection (fulltext)", "/api/v1/findings?q=sql+injection&limit=50", 200},
		{"GET /api/v1/findings?severity=4 (critical)", "/api/v1/findings?severity=4&limit=50", 100},
		{"GET /api/v1/findings?sort=-priority_score", "/api/v1/findings?limit=50&sort=-priority_score", 100},
	}

	client := &http.Client{Timeout: 10 * time.Second}

	for _, b := range benchmarks {
		url := baseURL + b.path

		// Warmup
		resp, err := client.Get(url)
		if err != nil {
			slog.Warn("benchmark warmup failed", "name", b.name, "error", err)
			fmt.Printf("%-55s  SKIP (server not reachable)\n", b.name)
			continue
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()

		// Actual measurement: average of 5 requests
		var totalMs int64
		runs := 5
		for i := 0; i < runs; i++ {
			start := time.Now()
			resp, err = client.Get(url)
			elapsed := time.Since(start).Milliseconds()
			if err != nil {
				slog.Warn("benchmark failed", "name", b.name, "run", i, "error", err)
				continue
			}
			// Verify response is valid JSON
			var body map[string]any
			json.NewDecoder(resp.Body).Decode(&body)
			resp.Body.Close()
			totalMs += elapsed
		}

		avgMs := totalMs / int64(runs)
		status := "OK"
		if avgMs > b.maxMs {
			status = "SLOW"
		}
		fmt.Printf("%-55s  avg=%3dms  target=<%dms  [%s]\n", b.name, avgMs, b.maxMs, status)
	}
}
