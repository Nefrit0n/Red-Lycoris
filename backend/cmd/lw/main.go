package main

import (
	"bytes"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: lw <subcommand>")
		os.Exit(2)
	}
	switch os.Args[1] {
	case "upload":
		if err := runUpload(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", os.Args[1])
		os.Exit(2)
	}
}

type multiFlag []string

func (m *multiFlag) String() string { return strings.Join(*m, ",") }
func (m *multiFlag) Set(v string) error {
	*m = append(*m, v)
	return nil
}

type uploadArgs struct {
	Endpoint       string
	Project        string
	Token          string
	ArtifactRaw    []string
	CI             string
	Enrich         string
	IdempotencyKey string
	StateFile      string
	MaxConcurrency int
	MaxRetries     int
	Timeout        time.Duration
	Insecure       bool
	CAFile         string
	LogFormat      string
}

func runUpload(args []string) error {
	fs := flag.NewFlagSet("upload", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var artifacts multiFlag
	cfg := uploadArgs{}
	fs.StringVar(&cfg.Endpoint, "endpoint", "", "required")
	fs.StringVar(&cfg.Project, "project", "", "required")
	fs.StringVar(&cfg.Token, "token", "", "required")
	fs.Var(&artifacts, "artifact", "artifact path[:k=v,...], repeatable")
	fs.StringVar(&cfg.CI, "ci", "auto", "gitlab|auto")
	fs.StringVar(&cfg.Enrich, "enrich", "env", "env,git")
	fs.StringVar(&cfg.IdempotencyKey, "idempotency-key", "", "optional")
	fs.StringVar(&cfg.StateFile, "state-file", ".lw-upload-state.json", "resume state file")
	fs.IntVar(&cfg.MaxConcurrency, "max-concurrency", 4, "upload concurrency")
	fs.IntVar(&cfg.MaxRetries, "max-retries", 6, "request retries")
	fs.DurationVar(&cfg.Timeout, "timeout", 60*time.Second, "http timeout")
	fs.BoolVar(&cfg.Insecure, "insecure", false, "disable TLS certificate verification (dev only)")
	fs.StringVar(&cfg.CAFile, "ca-file", "", "path to PEM CA bundle")
	fs.StringVar(&cfg.LogFormat, "log", "text", "json|text")
	if err := fs.Parse(args); err != nil {
		return err
	}
	cfg.ArtifactRaw = artifacts
	if cfg.Endpoint == "" || cfg.Project == "" || cfg.Token == "" || len(cfg.ArtifactRaw) == 0 {
		return errors.New("required: --endpoint --project --token --artifact")
	}
	log := newLogger(cfg.LogFormat)

	parsedArtifacts, err := parseArtifacts(cfg.ArtifactRaw)
	if err != nil {
		return err
	}
	for i := range parsedArtifacts {
		if err := enrichArtifactFile(&parsedArtifacts[i]); err != nil {
			return err
		}
	}

	ciProvider := "local"
	if cfg.CI == "auto" {
		if isGitLabCIEnv(os.Environ()) {
			ciProvider = "gitlab"
		}
	}
	if cfg.CI == "gitlab" {
		if err := requireGitLabCIEnv(os.Environ()); err != nil {
			return err
		}
		ciProvider = "gitlab"
	}

	meta := buildMetadata(cfg, ciProvider)
	if cfg.IdempotencyKey == "" {
		cfg.IdempotencyKey = computeIdempotencyKey(cfg.Project, meta, parsedArtifacts)
	}

	state := loadState(cfg.StateFile)
	client, err := buildHTTPClient(cfg)
	if err != nil {
		return err
	}
	initResp, err := doInit(client, cfg, ciProvider, meta, parsedArtifacts)
	if err != nil {
		return err
	}
	state.RunID = initResp.RunID
	state.Endpoint = cfg.Endpoint
	state.Project = cfg.Project
	for _, item := range initResp.UploadPlan {
		if item.ObjectKey != "" {
			state.ObjectKeys[item.ArtifactPath] = item.ObjectKey
		}
	}
	saveState(cfg.StateFile, state)

	if err := uploadAll(client, log, cfg, parsedArtifacts, initResp, state); err != nil {
		return err
	}
	if err := doCommit(client, cfg, parsedArtifacts, initResp.RunID, state.ObjectKeys); err != nil {
		return err
	}
	log.Info("upload completed", "run_id", initResp.RunID)
	return nil
}

func newLogger(format string) *slog.Logger {
	if format == "json" {
		return slog.New(slog.NewJSONHandler(os.Stderr, nil))
	}
	return slog.New(slog.NewTextHandler(os.Stderr, nil))
}

type artifactSpec struct {
	Path        string            `json:"path"`
	SizeBytes   int64             `json:"size_bytes"`
	SHA256      string            `json:"sha256"`
	MediaType   string            `json:"media_type"`
	FormatHint  string            `json:"format_hint"`
	ToolName    string            `json:"tool_name,omitempty"`
	ToolVersion string            `json:"tool_version,omitempty"`
	meta        map[string]string `json:"-"`
}

func parseArtifacts(raw []string) ([]artifactSpec, error) {
	out := make([]artifactSpec, 0, len(raw))
	for _, item := range raw {
		parts := strings.SplitN(item, ":", 2)
		s := artifactSpec{Path: parts[0], meta: map[string]string{}}
		if len(parts) == 2 {
			for _, kv := range strings.Split(parts[1], ",") {
				p := strings.SplitN(strings.TrimSpace(kv), "=", 2)
				if len(p) == 2 {
					s.meta[p[0]] = p[1]
				}
			}
		}
		s.FormatHint = s.meta["format"]
		s.ToolName = s.meta["tool_name"]
		s.ToolVersion = s.meta["tool_version"]
		out = append(out, s)
	}
	return out, nil
}

func enrichArtifactFile(a *artifactSpec) error {
	clean := filepath.Clean(a.Path)
	f, err := os.Open(clean)
	if err != nil {
		return err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return err
	}
	a.SizeBytes = st.Size()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	a.SHA256 = hex.EncodeToString(h.Sum(nil))
	if a.FormatHint == "" {
		a.FormatHint = inferFormatHint(clean)
	}
	if a.MediaType == "" {
		a.MediaType = inferMediaType(clean)
	}
	return nil
}

func inferMediaType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if ext != "" {
		if mt := mime.TypeByExtension(ext); mt != "" {
			return mt
		}
	}
	return "application/octet-stream"
}

func inferFormatHint(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".json":
		return "json"
	case ".sarif":
		return "sarif"
	case ".xml":
		return "xml"
	default:
		return "generic"
	}
}

var gitLabAllowlist = []string{
	"CI", "GITLAB_CI", "CI_PIPELINE_ID", "CI_PIPELINE_IID", "CI_PIPELINE_URL", "CI_PIPELINE_SOURCE", "CI_JOB_ID", "CI_JOB_URL",
	"CI_JOB_NAME", "CI_JOB_STAGE", "CI_JOB_STARTED_AT", "CI_PROJECT_ID", "CI_PROJECT_PATH", "CI_PROJECT_URL", "CI_COMMIT_SHA",
	"CI_COMMIT_REF_NAME", "CI_COMMIT_TAG", "CI_COMMIT_BRANCH", "CI_COMMIT_TIMESTAMP", "CI_SERVER_URL", "CI_API_V4_URL",
	"CI_MERGE_REQUEST_IID", "CI_RUNNER_ID", "CI_RUNNER_TAGS",
}

func isGitLabCIEnv(env []string) bool {
	m := toEnvMap(env)
	if !isTrueCIFlag(m["CI"]) || !isTrueCIFlag(m["GITLAB_CI"]) {
		return false
	}
	return m["CI_PIPELINE_ID"] != "" && m["CI_JOB_ID"] != ""
}

func requireGitLabCIEnv(env []string) error {
	m := toEnvMap(env)
	if !isTrueCIFlag(m["CI"]) || !isTrueCIFlag(m["GITLAB_CI"]) {
		return errors.New("ci=gitlab requires CI=true and GITLAB_CI=true")
	}
	if m["CI_JOB_ID"] == "" || m["CI_PIPELINE_ID"] == "" {
		return errors.New("ci=gitlab requires CI_JOB_ID and CI_PIPELINE_ID")
	}
	return nil
}

func isTrueCIFlag(v string) bool {
	return strings.EqualFold(strings.TrimSpace(v), "true") || strings.TrimSpace(v) == "1"
}

func collectAllowlistGitLabEnv(env []string) map[string]string {
	m := toEnvMap(env)
	out := map[string]string{}
	for _, k := range gitLabAllowlist {
		if v := strings.TrimSpace(m[k]); v != "" {
			out[k] = v
		}
	}
	return out
}

func toEnvMap(env []string) map[string]string {
	m := map[string]string{}
	for _, kv := range env {
		p := strings.SplitN(kv, "=", 2)
		if len(p) == 2 {
			m[p[0]] = p[1]
		}
	}
	return m
}

func buildMetadata(cfg uploadArgs, provider string) map[string]any {
	envmap := toEnvMap(os.Environ())
	meta := map[string]any{
		"schema_version": "1.0",
		"producer":       map[string]string{"name": "lw", "version": "0.1.0", "build": "dev"},
		"tenant":         map[string]string{"org_id": "", "project_id": cfg.Project},
		"gitlab_context": map[string]string{},
		"git": map[string]string{
			"repo_url": envmap["CI_PROJECT_URL"],
			"ref":      envmap["CI_COMMIT_REF_NAME"],
			"sha":      envmap["CI_COMMIT_SHA"],
		},
		"run": map[string]string{
			"pipeline_id": envmap["CI_PIPELINE_ID"],
			"job_id":      envmap["CI_JOB_ID"],
			"job_name":    envmap["CI_JOB_NAME"],
			"stage":       envmap["CI_JOB_STAGE"],
		},
	}
	if provider == "gitlab" && strings.Contains(cfg.Enrich, "env") {
		meta["gitlab_context"] = collectAllowlistGitLabEnv(os.Environ())
	}
	if !strings.Contains(cfg.Enrich, "git") {
		delete(meta, "git")
	}
	return meta
}

func computeIdempotencyKey(project string, metadata map[string]any, artifacts []artifactSpec) string {
	sorted := append([]artifactSpec(nil), artifacts...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Path < sorted[j].Path })
	buf := bytes.Buffer{}
	buf.WriteString(project)
	mj, _ := json.Marshal(metadata)
	buf.Write(mj)
	for _, a := range sorted {
		buf.WriteString(a.Path)
		buf.WriteString(a.SHA256)
		buf.WriteString(strconv.FormatInt(a.SizeBytes, 10))
		buf.WriteString(a.FormatHint)
	}
	s := sha256.Sum256(buf.Bytes())
	return hex.EncodeToString(s[:])
}

type initRequest struct {
	Provider  string         `json:"provider"`
	Metadata  map[string]any `json:"metadata"`
	Artifacts []artifactSpec `json:"artifacts"`
}

type uploadPlanPart struct {
	PartNumber int    `json:"part_number"`
	URL        string `json:"url"`
	Offset     int64  `json:"offset"`
	Size       int64  `json:"size"`
}

type uploadPlanItem struct {
	ArtifactPath string `json:"artifact_path"`
	ObjectKey    string `json:"object_key"`
	UploadMode   string `json:"upload_mode"`
	PutURL       string `json:"put_url"`
	Multipart    struct {
		UploadID      string           `json:"upload_id"`
		CompleteURL   string           `json:"complete_url"`
		AbortURL      string           `json:"abort_url"`
		PartSizeBytes int64            `json:"part_size_bytes"`
		Parts         []uploadPlanPart `json:"parts"`
	} `json:"multipart"`
}

type initResponse struct {
	RunID      string           `json:"run_id"`
	State      string           `json:"state"`
	UploadPlan []uploadPlanItem `json:"upload_plan"`
}

func doInit(client *http.Client, cfg uploadArgs, provider string, metadata map[string]any, artifacts []artifactSpec) (*initResponse, error) {
	payload, _ := json.Marshal(initRequest{Provider: provider, Metadata: metadata, Artifacts: artifacts})
	url := strings.TrimRight(cfg.Endpoint, "/") + "/api/v1/ingest/runs:init"
	var out initResponse
	err := doJSONWithRetry(client, cfg.MaxRetries, http.MethodPost, url, cfg.Token, cfg.IdempotencyKey, payload, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func doCommit(client *http.Client, cfg uploadArgs, artifacts []artifactSpec, runID string, objectKeys map[string]string) error {
	type commitArtifact struct {
		Path      string `json:"path"`
		SHA256    string `json:"sha256"`
		SizeBytes int64  `json:"size_bytes"`
		ObjectKey string `json:"object_key"`
	}
	items := make([]commitArtifact, 0, len(artifacts))
	for _, a := range artifacts {
		items = append(items, commitArtifact{Path: a.Path, SHA256: a.SHA256, SizeBytes: a.SizeBytes, ObjectKey: objectKeys[a.Path]})
	}
	body, _ := json.Marshal(map[string]any{"artifacts": items})
	url := strings.TrimRight(cfg.Endpoint, "/") + "/api/v1/ingest/runs/" + runID + ":commit"
	return doJSONWithRetry(client, cfg.MaxRetries, http.MethodPost, url, cfg.Token, "", body, nil)
}

func doJSONWithRetry(client *http.Client, maxRetries int, method, url, token, idem string, body []byte, out any) error {
	return withRetry(maxRetries, func() (bool, error) {
		req, _ := http.NewRequest(method, url, bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		if idem != "" {
			req.Header.Set("X-Idempotency-Key", idem)
		}
		resp, err := client.Do(req)
		if err != nil {
			return isRetryableNetErr(err), err
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == 429 || resp.StatusCode >= 500 {
			return true, retryAfterErr(resp.Header.Get("Retry-After"), string(b))
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return false, fmt.Errorf("http %d: %s", resp.StatusCode, string(b))
		}
		if out != nil {
			if err := json.Unmarshal(b, out); err != nil {
				return false, err
			}
		}
		return false, nil
	})
}

type retryAfter struct {
	wait time.Duration
	err  error
}

func (r retryAfter) Error() string { return r.err.Error() }
func retryAfterErr(h, msg string) error {
	r := retryAfter{wait: 0, err: errors.New(msg)}
	if h == "" {
		return r
	}
	if secs, err := strconv.Atoi(h); err == nil {
		r.wait = time.Duration(secs) * time.Second
		return r
	}
	if t, err := http.ParseTime(h); err == nil {
		r.wait = time.Until(t)
	}
	return r
}

func withRetry(maxRetries int, fn func() (retry bool, err error)) error {
	if maxRetries < 1 {
		maxRetries = 1
	}
	base := 500 * time.Millisecond
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	for i := 0; i < maxRetries; i++ {
		retry, err := fn()
		if err == nil {
			return nil
		}
		if !retry || i == maxRetries-1 {
			return err
		}
		wait := base * time.Duration(1<<i)
		var r retryAfter
		if errors.As(err, &r) && r.wait > 0 {
			wait = r.wait
		}
		jitter := time.Duration(rng.Int63n(int64(wait/4) + 1))
		time.Sleep(wait + jitter)
	}
	return nil
}

func isRetryableNetErr(err error) bool {
	if err == nil {
		return false
	}
	if ne, ok := err.(net.Error); ok && (ne.Timeout() || ne.Temporary()) {
		return true
	}
	return true
}

type uploadState struct {
	RunID      string            `json:"run_id"`
	Endpoint   string            `json:"endpoint"`
	Project    string            `json:"project"`
	Uploaded   map[string]string `json:"uploaded"`
	ObjectKeys map[string]string `json:"object_keys"`
	UpdatedAt  time.Time         `json:"updated_at"`
}

func loadState(path string) uploadState {
	st := uploadState{Uploaded: map[string]string{}, ObjectKeys: map[string]string{}}
	b, err := os.ReadFile(path)
	if err != nil {
		return st
	}
	_ = json.Unmarshal(b, &st)
	if st.Uploaded == nil {
		st.Uploaded = map[string]string{}
	}
	if st.ObjectKeys == nil {
		st.ObjectKeys = map[string]string{}
	}
	return st
}

func saveState(path string, st uploadState) {
	st.UpdatedAt = time.Now().UTC()
	b, _ := json.MarshalIndent(st, "", "  ")
	_ = os.WriteFile(path, b, 0o600)
}

func uploadAll(client *http.Client, log *slog.Logger, cfg uploadArgs, artifacts []artifactSpec, initResp *initResponse, st uploadState) error {
	planByPath := map[string]uploadPlanItem{}
	for _, p := range initResp.UploadPlan {
		planByPath[p.ArtifactPath] = p
	}
	sem := make(chan struct{}, max(1, cfg.MaxConcurrency))
	var wg sync.WaitGroup
	var firstErr error
	var mu sync.Mutex
	for _, a := range artifacts {
		plan, ok := planByPath[a.Path]
		if !ok {
			return fmt.Errorf("missing upload plan for %s", a.Path)
		}
		uploadStateKey := plan.ObjectKey
		if uploadStateKey == "" {
			uploadStateKey = a.Path
		}
		if _, done := st.Uploaded[uploadStateKey]; done {
			continue
		}
		a := a
		pitem := plan
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			etag, err := uploadOne(client, a, pitem)
			if err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
				return
			}
			mu.Lock()
			stateKey := pitem.ObjectKey
			if stateKey == "" {
				stateKey = a.Path
			}
			st.Uploaded[stateKey] = etag
			saveState(cfg.StateFile, st)
			mu.Unlock()
			log.Info("uploaded artifact", "path", a.Path)
		}()
	}
	wg.Wait()
	return firstErr
}

func uploadOne(client *http.Client, a artifactSpec, plan uploadPlanItem) (string, error) {
	f, err := os.Open(filepath.Clean(a.Path))
	if err != nil {
		return "", err
	}
	defer f.Close()
	if plan.UploadMode == "presigned_put" {
		req, _ := http.NewRequest(http.MethodPut, plan.PutURL, f)
		resp, err := client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			b, _ := io.ReadAll(resp.Body)
			return "", fmt.Errorf("upload failed: %s", string(b))
		}
		return resp.Header.Get("ETag"), nil
	}
	parts := make([]completePart, 0, len(plan.Multipart.Parts))
	offsets, err := computeMultipartRanges(a.SizeBytes, plan)
	if err != nil {
		return "", err
	}
	for _, p := range plan.Multipart.Parts {
		r, ok := offsets[p.PartNumber]
		if !ok {
			return "", fmt.Errorf("missing range for part %d", p.PartNumber)
		}
		chunk := io.NewSectionReader(f, r.Offset, r.Size)
		req, _ := http.NewRequest(http.MethodPut, p.URL, chunk)
		resp, err := client.Do(req)
		if err != nil {
			abortMultipart(client, plan)
			return "", err
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			resp.Body.Close()
			abortMultipart(client, plan)
			return "", fmt.Errorf("multipart part upload failed: %d", resp.StatusCode)
		}
		parts = append(parts, completePart{PartNumber: p.PartNumber, ETag: strings.Trim(resp.Header.Get("ETag"), "\"")})
		resp.Body.Close()
	}
	sort.Slice(parts, func(i, j int) bool { return parts[i].PartNumber < parts[j].PartNumber })
	xmlBody, _ := xml.Marshal(completeMultipartUpload{Parts: parts})
	req, _ := http.NewRequest(http.MethodPost, plan.Multipart.CompleteURL, bytes.NewReader(xmlBody))
	req.Header.Set("Content-Type", "application/xml")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		abortMultipart(client, plan)
		return "", fmt.Errorf("multipart complete failed")
	}
	return resp.Header.Get("ETag"), nil
}

type multipartRange struct {
	Offset int64
	Size   int64
}

func computeMultipartRanges(fileSize int64, plan uploadPlanItem) (map[int]multipartRange, error) {
	out := make(map[int]multipartRange, len(plan.Multipart.Parts))
	hasExplicit := true
	for _, p := range plan.Multipart.Parts {
		if p.Offset < 0 || p.Size <= 0 {
			hasExplicit = false
			break
		}
	}
	if hasExplicit {
		for _, p := range plan.Multipart.Parts {
			out[p.PartNumber] = multipartRange{Offset: p.Offset, Size: p.Size}
		}
		return out, nil
	}
	partSize := plan.Multipart.PartSizeBytes
	if partSize <= 0 {
		if len(plan.Multipart.Parts) == 0 {
			return nil, errors.New("multipart plan has no parts")
		}
		partSize = (fileSize + int64(len(plan.Multipart.Parts)) - 1) / int64(len(plan.Multipart.Parts))
	}
	for i, p := range plan.Multipart.Parts {
		offset := int64(i) * partSize
		size := partSize
		remaining := fileSize - offset
		if remaining <= 0 {
			size = 0
		} else if remaining < size {
			size = remaining
		}
		out[p.PartNumber] = multipartRange{Offset: offset, Size: size}
	}
	return out, nil
}

func abortMultipart(client *http.Client, plan uploadPlanItem) {
	if strings.TrimSpace(plan.Multipart.AbortURL) == "" {
		return
	}
	req, _ := http.NewRequest(http.MethodPost, plan.Multipart.AbortURL, nil)
	resp, err := client.Do(req)
	if err == nil && resp != nil {
		resp.Body.Close()
	}
}

func buildHTTPClient(cfg uploadArgs) (*http.Client, error) {
	tlsConfig := &tls.Config{}
	if cfg.Insecure {
		tlsConfig.InsecureSkipVerify = true
	}
	if cfg.CAFile != "" {
		pem, err := os.ReadFile(filepath.Clean(cfg.CAFile))
		if err != nil {
			return nil, fmt.Errorf("read ca-file: %w", err)
		}
		pool, err := x509.SystemCertPool()
		if err != nil || pool == nil {
			pool = x509.NewCertPool()
		}
		if ok := pool.AppendCertsFromPEM(pem); !ok {
			return nil, errors.New("ca-file does not contain valid PEM certificates")
		}
		tlsConfig.RootCAs = pool
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if cfg.Insecure || cfg.CAFile != "" {
		transport.TLSClientConfig = tlsConfig
	}
	return &http.Client{Timeout: cfg.Timeout, Transport: transport}, nil
}

type completeMultipartUpload struct {
	XMLName xml.Name       `xml:"CompleteMultipartUpload"`
	Parts   []completePart `xml:"Part"`
}

type completePart struct {
	PartNumber int    `xml:"PartNumber"`
	ETag       string `xml:"ETag"`
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
