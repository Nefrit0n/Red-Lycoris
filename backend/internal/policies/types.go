package policies

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
)

type Subject struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type Actor struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type Event struct {
	Type       string  `json:"type"`
	Actor      *Actor  `json:"actor,omitempty"`
	FromStatus *string `json:"fromStatus,omitempty"`
	ToStatus   *string `json:"toStatus,omitempty"`
	Profile    *string `json:"profile,omitempty"`
	CommitSha  *string `json:"commitSha,omitempty"`
	BuildID    *string `json:"buildId,omitempty"`
}

type Finding struct {
	Title        *string `json:"title,omitempty"`
	Severity     string  `json:"severity"`
	Status       *string `json:"status,omitempty"`
	Category     *string `json:"category,omitempty"`
	Scanner      *string `json:"scanner,omitempty"`
	SourceType   *string `json:"sourceType,omitempty"`
	FirstSeenAt  *string `json:"firstSeenAt,omitempty"`
	LastSeenAt   *string `json:"lastSeenAt,omitempty"`
	ProductID    *string `json:"productId,omitempty"`
	ImportJobID  *string `json:"importJobId,omitempty"`
	FixedVersion *string `json:"fixedVersion,omitempty"`
}

type SeverityCount struct {
	Severity string `json:"severity"`
	Count    int    `json:"count"`
}

type CategoryCount struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

type ImportJob struct {
	ID              string          `json:"id"`
	Scanner         string          `json:"scanner"`
	Status          string          `json:"status"`
	FindingsTotal   int             `json:"findingsTotal"`
	FindingsNew     int             `json:"findingsNew"`
	DuplicatesTotal int             `json:"duplicatesTotal"`
	CreatedAt       string          `json:"createdAt"`
	StartedAt       *string         `json:"startedAt,omitempty"`
	FinishedAt      *string         `json:"finishedAt,omitempty"`
	SeverityCounts  []SeverityCount `json:"severityCounts,omitempty"`
	CategoryCounts  []CategoryCount `json:"categoryCounts,omitempty"`
}

type ScanResult struct {
	ID             string          `json:"id"`
	Scanner        string          `json:"scanner"`
	CreatedAt      string          `json:"createdAt"`
	ProcessedAt    *string         `json:"processedAt,omitempty"`
	SeverityCounts []SeverityCount `json:"severityCounts,omitempty"`
	CategoryCounts []CategoryCount `json:"categoryCounts,omitempty"`
}

type Product struct {
	ID               string   `json:"id"`
	Tags             []string `json:"tags,omitempty"`
	Environment      *string  `json:"environment,omitempty"`
	AssetCriticality *string  `json:"assetCriticality,omitempty"`
}

type Context struct {
	Subject    Subject     `json:"subject"`
	Event      Event       `json:"event"`
	Finding    *Finding    `json:"finding,omitempty"`
	ImportJob  *ImportJob  `json:"importJob,omitempty"`
	ScanResult *ScanResult `json:"scanResult,omitempty"`
	Product    *Product    `json:"product,omitempty"`
}

func (c Context) StableJSON() ([]byte, error) {
	copyCtx := c
	if copyCtx.Product != nil {
		copyCtx.Product = copyCtx.Product.sorted()
	}
	if copyCtx.ImportJob != nil {
		copyCtx.ImportJob = copyCtx.ImportJob.sorted()
	}
	if copyCtx.ScanResult != nil {
		copyCtx.ScanResult = copyCtx.ScanResult.sorted()
	}
	return json.Marshal(copyCtx)
}

func (job *ImportJob) sorted() *ImportJob {
	clone := *job
	clone.SeverityCounts = sortedSeverityCounts(job.SeverityCounts)
	clone.CategoryCounts = sortedCategoryCounts(job.CategoryCounts)
	return &clone
}

func (result *ScanResult) sorted() *ScanResult {
	clone := *result
	clone.SeverityCounts = sortedSeverityCounts(result.SeverityCounts)
	clone.CategoryCounts = sortedCategoryCounts(result.CategoryCounts)
	return &clone
}

func (product *Product) sorted() *Product {
	clone := *product
	if len(product.Tags) > 0 {
		clone.Tags = append([]string(nil), product.Tags...)
		sort.Strings(clone.Tags)
	}
	return &clone
}

func sortedSeverityCounts(counts []SeverityCount) []SeverityCount {
	if len(counts) == 0 {
		return nil
	}
	clone := append([]SeverityCount(nil), counts...)
	sort.Slice(clone, func(i, j int) bool {
		return clone[i].Severity < clone[j].Severity
	})
	return clone
}

func sortedCategoryCounts(counts []CategoryCount) []CategoryCount {
	if len(counts) == 0 {
		return nil
	}
	clone := append([]CategoryCount(nil), counts...)
	sort.Slice(clone, func(i, j int) bool {
		return clone[i].Category < clone[j].Category
	})
	return clone
}

type Action struct {
	Type       string  `json:"type"`
	AssigneeID *string `json:"assigneeId,omitempty"`
	Status     *string `json:"status,omitempty"`
	DueAt      *string `json:"dueAt,omitempty"`
	Reason     *string `json:"reason,omitempty"`
}

type Violation struct {
	Code     string   `json:"code"`
	Message  string   `json:"message"`
	Severity string   `json:"severity"`
	Refs     []string `json:"refs,omitempty"`
}

type PolicyMeta struct {
	PolicyID      string  `json:"policyId"`
	PolicyRuleID  *string `json:"policyRuleId,omitempty"`
	PolicyVersion string  `json:"policyVersion"`
	Sha256        string  `json:"sha256"`
}

type Decision struct {
	Outcome    string      `json:"outcome"`
	Actions    []Action    `json:"actions,omitempty"`
	Violations []Violation `json:"violations,omitempty"`
	Policy     *PolicyMeta `json:"policy,omitempty"`
	DecisionID *string     `json:"decisionId,omitempty"`
}

type Evaluator interface {
	Evaluate(ctx Context) (Decision, error)
}

func InputHash(ctx Context) (string, error) {
	inputJSON, err := ctx.StableJSON()
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(inputJSON)
	return hex.EncodeToString(sum[:]), nil
}
