package main

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/auth"
	"redlycoris/internal/config"
	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
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

var filePaths = []string{
	"src/auth.py",
	"cmd/main.go",
	"api/users.js",
	"internal/db/query.go",
	"services/payment.ts",
	"pkg/http/client.go",
	"src/components/Login.tsx",
	"deploy/terraform/main.tf",
	"deploy/k8s/deployment.yaml",
}

var scaComponents = []string{
	"log4j-core", "spring-core", "lodash", "requests", "axios",
	"jackson-databind", "django", "flask", "urllib3", "express",
}

var scaEcosystems = []string{"npm", "pypi", "maven", "go", "nuget"}

var scaCVEPool = []string{
	"CVE-2021-44228", "CVE-2022-22965", "CVE-2021-45046", "CVE-2023-34362",
	"CVE-2022-22963", "CVE-2023-38545", "CVE-2024-3094", "CVE-2023-45133",
}

var sastRuleIDs = []string{
	"semgrep.python.sqli", "semgrep.js.xss", "gosec.G101", "bandit.B608",
	"semgrep.go.path-traversal", "semgrep.ts.open-redirect", "semgrep.java.ssti",
}

var dastURLs = []string{
	"https://app.local/api/v1/users?id=1",
	"https://app.local/login",
	"https://app.local/search?q=test",
	"https://app.local/redirect?url=https://evil.test",
}

var dastHTTPMethods = []string{"GET", "POST", "PUT"}
var dastHTTPParams = []string{"id", "username", "search", "redirect", "url"}

var iacResources = []string{
	"aws_s3_bucket.logs",
	"aws_iam_role.app",
	"Deployment/nginx",
	"azurerm_storage_account.data",
}

var iacProviders = []string{"aws", "azure", "gcp", "kubernetes"}

var secretKinds = []string{"aws_access_key", "github_pat", "private_key", "slack_webhook"}

var secretFilePaths = []string{".env", "config/secrets.yaml"}

var sastSnippets = []string{
	`query = "SELECT * FROM users WHERE id = " + user_input`,
	`res.send("<div>" + req.query.name + "</div>")`,
	`cmd := "sh -c " + os.Args[1]`,
	`open("/var/data/" + request.args["path"], "r")`,
	`cursor.execute(f"SELECT * FROM orders WHERE id={order_id}")`,
	`return redirect(request.GET["url"])`,
	`Runtime.getRuntime().exec(request.getParameter("cmd"));`,
	`password := "hardcoded-secret-token"`,
	`yaml.load(input_data, Loader=yaml.FullLoader)`,
	`http.Get("http://" + host + "/admin")`,
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

	usersRepo := storage.NewUsersRepo(pool)
	rolesRepo := storage.NewUserProjectRolesRepo(pool)

	adminUser, err := ensureAdminUser(ctx, usersRepo)
	if err != nil {
		slog.Error("failed to ensure admin user", "error", err)
		os.Exit(1)
	}

	totalFindings := seededFindingsCount()
	batchSize := 1000

	// 1. Create projects
	slog.Info("creating projects...")
	projectIDs, err := seedProjects(ctx, pool, rolesRepo, adminUser.ID)
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

func ensureAdminUser(ctx context.Context, usersRepo *storage.UsersRepo) (*domain.User, error) {
	user, err := usersRepo.GetByEmail(ctx, "admin@local")
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("ensureAdminUser: get by email: %w", err)
	}

	hash, err := auth.Hash("admin12345")
	if err != nil {
		return nil, fmt.Errorf("ensureAdminUser: hash: %w", err)
	}

	adminUser := &domain.User{
		Email:        "admin@local",
		PasswordHash: hash,
		FullName:     "Admin",
		IsActive:     true,
		GlobalRole:   domain.RoleAdmin,
	}
	if err := usersRepo.Create(ctx, adminUser); err != nil {
		return nil, fmt.Errorf("ensureAdminUser: create: %w", err)
	}
	return adminUser, nil
}

func seedProjects(ctx context.Context, pool *pgxpool.Pool, rolesRepo *storage.UserProjectRolesRepo, adminID uuid.UUID) ([]uuid.UUID, error) {
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

		grantedBy := adminID
		if err := rolesRepo.Grant(ctx, nil, adminID, ids[i], domain.RoleProjectAdmin, &grantedBy); err != nil {
			return nil, fmt.Errorf("seedProjects: grant admin role %s: %w", p.name, err)
		}
	}
	return ids, nil
}

func generateFinding(projectIDs []uuid.UUID, weights []float64) []any {
	// Pick project by weight
	r := randFloat64()
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

	// Timestamps: first_seen randomly within last 180 days
	daysAgo := randIntN(180)
	firstSeen := time.Now().AddDate(0, 0, -daysAgo)
	lastSeen := firstSeen.Add(time.Duration(randIntN(daysAgo+1)) * 24 * time.Hour)
	if lastSeen.After(time.Now()) {
		lastSeen = time.Now()
	}
	timesSeen := 1 + randIntN(20)

	kindBucket := randFloat64()
	f := domain.Finding{
		ID:         uuid.New(),
		ProjectID:  projectID,
		Status:     pickWeighted([]int{0, 1, 2, 3, 4}, []float64{0.60, 0.15, 0.10, 0.10, 0.05}),
		Confidence: randIntN(4),
		FirstSeen:  firstSeen,
		LastSeen:   lastSeen,
		TimesSeen:  timesSeen,
	}

	switch {
	case kindBucket < 0.40:
		fillSCAFinding(&f)
	case kindBucket < 0.70:
		fillSASTFinding(&f)
	case kindBucket < 0.80:
		fillDASTFinding(&f)
	case kindBucket < 0.90:
		fillIaCFinding(&f)
	default:
		fillSecretsFinding(&f)
	}

	f.Fingerprint = domain.CalculateFingerprint(&f)

	return []any{
		f.ID, f.Title, f.Description, f.Severity, f.Confidence, f.Status,
		f.FilePath, f.LineStart, f.LineEnd, f.Component, f.ComponentVersion,
		f.CVEIDs, f.CWEIDs, f.CPEURI, f.Fingerprint,
		f.FirstSeen, f.LastSeen, f.TimesSeen, f.ProjectID, f.SourceType, int16(f.Kind),
		f.FixedVersion, f.PackageEcosystem, f.Purl, f.CodeSnippet, f.CodeFlow,
		f.URL, f.HttpMethod, f.HttpParam, f.HttpEvidence, f.IacResource,
		f.IacProvider, f.SecretKind, f.CommitSHA, f.RuleID, f.RuleName,
	}
}

func pickWeighted(values []int, weights []float64) int {
	r := randFloat64()
	cumulative := 0.0
	for i, w := range weights {
		cumulative += w
		if r < cumulative {
			return values[i]
		}
	}
	return values[len(values)-1]
}

func seededFindingsCount() int {
	raw := strings.TrimSpace(os.Getenv("SEED_FINDINGS_COUNT"))
	if raw == "" {
		return 100_000
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 100_000
	}
	return n
}

func fillSCAFinding(f *domain.Finding) {
	component := scaComponents[randIntN(len(scaComponents))]
	version := randomSemVer()
	ecosystem := scaEcosystems[randIntN(len(scaEcosystems))]
	purl := fmt.Sprintf("pkg:%s/%s@%s", ecosystem, component, version)

	f.Kind = domain.KindSCA
	f.Title = fmt.Sprintf("Vulnerable dependency: %s", component)
	f.Description = fmt.Sprintf("Known vulnerability in %s@%s", component, version)
	f.Severity = pickWeighted([]int{1, 2, 3, 4}, []float64{0.20, 0.45, 0.25, 0.10})
	f.Component = component
	f.ComponentVersion = version
	f.CVEIDs = []string{scaCVEPool[randIntN(len(scaCVEPool))]}
	f.CWEIDs = []int{79, 89}
	f.CPEURI = ""
	f.SourceType = "trivy"
	f.PackageEcosystem = &ecosystem
	f.Purl = &purl

	if randFloat64() < 0.70 {
		fixed := incVersion(version)
		f.FixedVersion = &fixed
	}
}

func fillSASTFinding(f *domain.Finding) {
	ruleID := sastRuleIDs[randIntN(len(sastRuleIDs))]
	snippet := sastSnippets[randIntN(len(sastSnippets))]
	lineStart := 10 + randIntN(491)
	lineEnd := lineStart + randIntN(11)

	f.Kind = domain.KindSAST
	f.Title = firstSentence(ruleID + " finding")
	f.Description = fmt.Sprintf("Potential insecure code pattern matched by %s", ruleID)
	f.Severity = pickWeighted([]int{1, 2, 3, 4}, []float64{0.15, 0.40, 0.35, 0.10})
	f.FilePath = filePaths[randIntN(len(filePaths))]
	f.LineStart = lineStart
	f.LineEnd = lineEnd
	f.RuleID = &ruleID
	ruleName := firstSentence(ruleID)
	f.RuleName = &ruleName
	f.CodeSnippet = &snippet
	f.CWEIDs = []int{79, 89, 22}
	f.CVEIDs = []string{}
	f.SourceType = "semgrep"
}

func fillDASTFinding(f *domain.Finding) {
	url := dastURLs[randIntN(len(dastURLs))]
	method := dastHTTPMethods[randIntN(len(dastHTTPMethods))]
	param := dastHTTPParams[randIntN(len(dastHTTPParams))]

	f.Kind = domain.KindDAST
	f.Title = "Dynamic scan issue"
	f.Description = "Potentially exploitable behavior detected during runtime scan"
	f.Severity = pickWeighted([]int{1, 2, 3}, []float64{0.20, 0.50, 0.30})
	f.URL = &url
	f.HttpMethod = &method
	f.HttpParam = &param
	f.CWEIDs = []int{79, 89}
	f.CVEIDs = []string{}
	f.SourceType = "zap"
}

func fillIaCFinding(f *domain.Finding) {
	resource := iacResources[randIntN(len(iacResources))]
	provider := iacProviders[randIntN(len(iacProviders))]
	ruleID := fmt.Sprintf("CKV_%s_%02d", strings.ToUpper(provider), 1+randIntN(99))
	ruleName := "IaC misconfiguration"

	f.Kind = domain.KindIaC
	f.Title = "IaC policy violation"
	f.Description = "Infrastructure policy check failed"
	f.Severity = pickWeighted([]int{1, 2, 3, 4}, []float64{0.10, 0.45, 0.35, 0.10})
	f.IacResource = &resource
	f.IacProvider = &provider
	f.RuleID = &ruleID
	f.RuleName = &ruleName
	f.CVEIDs = []string{}
	f.CWEIDs = []int{}
	f.SourceType = "checkov"
}

func fillSecretsFinding(f *domain.Finding) {
	secretKind := secretKinds[randIntN(len(secretKinds))]
	commitSHA := randomHex(40)
	ruleName := "Leaked secret pattern"

	f.Kind = domain.KindSecrets
	f.Title = "Potential secret leak"
	f.Description = "Detected credential-like pattern in repository history"
	f.Severity = domain.SeverityHigh
	f.FilePath = secretFilePaths[randIntN(len(secretFilePaths))]
	f.SecretKind = &secretKind
	f.CommitSHA = &commitSHA
	f.RuleID = &secretKind
	f.RuleName = &ruleName
	f.CVEIDs = []string{}
	f.CWEIDs = []int{}
	f.SourceType = "gitleaks"
}

func randomSemVer() string {
	major := 1 + randIntN(2)
	minor := randIntN(10)
	patch := randIntN(10)
	return fmt.Sprintf("%d.%d.%d", major, minor, patch)
}

func incVersion(v string) string {
	parts := strings.Split(v, ".")
	if len(parts) != 3 {
		return v
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return v
	}
	patch++
	return fmt.Sprintf("%s.%s.%d", parts[0], parts[1], patch)
}

func randomHex(length int) string {
	const hexChars = "0123456789abcdef"
	b := make([]byte, length)
	for i := range b {
		b[i] = hexChars[randIntN(len(hexChars))]
	}
	return string(b)
}

func randIntN(n int) int {
	if n <= 0 {
		return 0
	}
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		panic(fmt.Errorf("crypto random int: %w", err))
	}
	return int(v.Int64())
}

func randFloat64() float64 {
	var b [8]byte
	if _, err := io.ReadFull(rand.Reader, b[:]); err != nil {
		panic(fmt.Errorf("crypto random float: %w", err))
	}
	const denom = float64(uint64(1) << 53)
	return float64(binary.BigEndian.Uint64(b[:])>>11) / denom
}

func firstSentence(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	if idx := strings.IndexByte(s, '\n'); idx >= 0 {
		return strings.TrimSpace(s[:idx])
	}
	return s
}

func batchInsertFindings(ctx context.Context, pool *pgxpool.Pool, rows [][]any) (int64, error) {
	cols := []string{
		"id", "title", "description", "severity", "confidence", "status",
		"file_path", "line_start", "line_end", "component", "component_version",
		"cve_ids", "cwe_ids", "cpe_uri", "fingerprint",
		"first_seen", "last_seen", "times_seen", "project_id", "source_type", "finding_kind",
		"fixed_version", "package_ecosystem", "purl", "code_snippet", "code_flow",
		"url", "http_method", "http_param", "http_evidence", "iac_resource",
		"iac_provider", "secret_kind", "commit_sha", "rule_id", "rule_name",
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
			if randFloat64() < 0.70 {
				batch = append(batch, s)
			}
		}
		rows.Close()

		if len(batch) == 0 {
			break
		}

		scoreRows := make([][]any, 0, len(batch))
		for _, s := range batch {
			baseScore := float64(s.severity)*2.0 + randFloat64()*2.0
			if baseScore > 10.0 {
				baseScore = 10.0
			}
			epssScore := randFloat64() * 0.5
			if s.severity >= 3 {
				epssScore = 0.1 + randFloat64()*0.8
			}
			epssPercentile := epssScore * 100
			isKEV := s.severity == 4 && randFloat64() < 0.3
			isBDU := randFloat64() < 0.1

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
		name  string
		path  string
		maxMs int64
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
		if _, copyErr := io.Copy(io.Discard, resp.Body); copyErr != nil {
			slog.Warn("benchmark warmup body discard failed", "name", b.name, "error", copyErr)
		}
		if closeErr := resp.Body.Close(); closeErr != nil {
			slog.Warn("benchmark warmup body close failed", "name", b.name, "error", closeErr)
		}

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
			if decodeErr := json.NewDecoder(resp.Body).Decode(&body); decodeErr != nil {
				slog.Warn("benchmark response decode failed", "name", b.name, "run", i, "error", decodeErr)
			}
			if closeErr := resp.Body.Close(); closeErr != nil {
				slog.Warn("benchmark response close failed", "name", b.name, "run", i, "error", closeErr)
			}
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
