package v1

import "encoding/json"

type FindingListItemDTO struct {
	ID               string        `json:"id"`
	TenantID         *string       `json:"tenantId,omitempty"`
	Title            string        `json:"title"`
	Severity         string        `json:"severity"`
	Status           string        `json:"status"`
	Category         string        `json:"category"`
	ScannerType      *string       `json:"scannerType,omitempty"`
	SourceType       *string       `json:"sourceType,omitempty"`
	Occurrence       *string       `json:"occurrenceStatus,omitempty"`
	FirstSeenAt      *string       `json:"firstSeenAt,omitempty"`
	LastSeenAt       *string       `json:"lastSeenAt,omitempty"`
	RepeatCount      *int          `json:"repeatCount,omitempty"`
	SLADueAt         *string       `json:"slaDueAt,omitempty"`
	SLABreached      *bool         `json:"slaBreached,omitempty"`
	SLABreachedAt    *string       `json:"slaBreachedAt,omitempty"`
	SLAProfile       *string       `json:"slaProfile,omitempty"`
	SLASource        *string       `json:"slaSource,omitempty"`
	SLADaysRemaining *int          `json:"slaDaysRemaining,omitempty"`
	ProductID        *string       `json:"productId,omitempty"`
	ProductName      *string       `json:"productName,omitempty"`
	AssigneeID       *string       `json:"assigneeId,omitempty"`
	Owner            *Owner        `json:"owner,omitempty"`
	ImportJobID      *string       `json:"importJobId,omitempty"`
	CreatedAt        string        `json:"createdAt"`
	UpdatedAt        string        `json:"updatedAt"`
	IntelSummary     *IntelSummary `json:"intel_summary,omitempty"`
}

type FindingDetailsSAST struct {
	RuleID    *string  `json:"ruleId,omitempty"`
	FilePath  *string  `json:"filePath,omitempty"`
	StartLine *int     `json:"startLine,omitempty"`
	EndLine   *int     `json:"endLine,omitempty"`
	Snippet   *string  `json:"snippet,omitempty"`
	Message   *string  `json:"message,omitempty"`
	CWE       []string `json:"cwe,omitempty"`
	OWASP     []string `json:"owasp,omitempty"`
}

type FindingDetailsSCA struct {
	PkgName          string   `json:"pkgName"`
	InstalledVersion string   `json:"installedVersion"`
	FixedVersion     *string  `json:"fixedVersion,omitempty"`
	VulnerabilityID  string   `json:"vulnerabilityId"`
	PrimaryURL       *string  `json:"primaryUrl,omitempty"`
	Ecosystem        *string  `json:"ecosystem,omitempty"`
	Purl             *string  `json:"purl,omitempty"`
	References       []string `json:"references,omitempty"`
	RawSeverity      *string  `json:"rawSeverity,omitempty"`
}

type FindingDetailsSecrets struct {
	RuleID   *string `json:"ruleId,omitempty"`
	FilePath *string `json:"filePath,omitempty"`
	Snippet  *string `json:"snippet,omitempty"`
	Message  *string `json:"message,omitempty"`
}

type FindingDetailsConfig struct {
	RuleID   *string `json:"ruleId,omitempty"`
	FilePath *string `json:"filePath,omitempty"`
	Message  *string `json:"message,omitempty"`
}

type Owner struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type FindingComment struct {
	ID        string  `json:"id"`
	AuthorID  *string `json:"authorId,omitempty"`
	Author    *string `json:"author,omitempty"`
	Body      string  `json:"body"`
	CreatedAt string  `json:"createdAt"`
}

type FindingEvent struct {
	ID        string                 `json:"id"`
	ActorID   *string                `json:"actorId,omitempty"`
	Actor     *string                `json:"actor,omitempty"`
	EventType string                 `json:"eventType"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt string                 `json:"createdAt"`
}

type FindingDetailDTO struct {
	FindingListItemDTO
	Description    *string                `json:"description,omitempty"`
	Fingerprint    *string                `json:"fingerprint,omitempty"`
	SourceType     *string                `json:"sourceType,omitempty"`
	SourceVersion  *string                `json:"sourceVersion,omitempty"`
	EndpointMethod *string                `json:"endpointMethod,omitempty"`
	EndpointPath   *string                `json:"endpointPath,omitempty"`
	Evidence       map[string]interface{} `json:"evidence,omitempty"`
	Details        interface{}            `json:"details,omitempty"`
	ScaDetails     *ScaDetails            `json:"scaDetails,omitempty"`
	IntelDetails   *IntelDetail           `json:"intel_details,omitempty"`
	Comments       []FindingComment       `json:"comments,omitempty"`
	Events         []FindingEvent         `json:"events,omitempty"`
	Occurrences    []FindingOccurrence    `json:"occurrences,omitempty"`
	Duplicates     *DuplicateGroup        `json:"duplicates,omitempty"`
	DeletedAt      *string                `json:"deletedAt,omitempty"`
}

type Finding = FindingListItemDTO
type FindingDetail = FindingDetailDTO

type ScaDetails struct {
	ComponentName    string   `json:"componentName"`
	Ecosystem        *string  `json:"ecosystem,omitempty"`
	Purl             *string  `json:"purl,omitempty"`
	InstalledVersion string   `json:"installedVersion"`
	FixedVersion     *string  `json:"fixedVersion,omitempty"`
	VulnerabilityID  string   `json:"vulnerabilityId"`
	PrimaryURL       *string  `json:"primaryUrl,omitempty"`
	References       []string `json:"references,omitempty"`
	RawSeverity      *string  `json:"rawSeverity,omitempty"`
}

type FindingOccurrence struct {
	ID          string  `json:"id"`
	ImportJobID *string `json:"importJobId,omitempty"`
	SeenAt      string  `json:"seenAt"`
	Status      string  `json:"status"`
	ScannerType *string `json:"scannerType,omitempty"`
	Snippet     *string `json:"snippet,omitempty"`
}

type DuplicateGroup struct {
	Master     Finding   `json:"master"`
	Duplicates []Finding `json:"duplicates"`
}

type FindingNeighbors struct {
	PrevID   *string `json:"prevId,omitempty"`
	NextID   *string `json:"nextId,omitempty"`
	Position int     `json:"position"`
	Total    int     `json:"total"`
}

type IntelSummary struct {
	Identifiers     []string   `json:"identifiers"`
	CVSS            *IntelCVSS `json:"cvss,omitempty"`
	EPSS            *IntelEPSS `json:"epss,omitempty"`
	KEV             bool       `json:"kev"`
	LastRefreshedAt *string    `json:"last_refreshed_at,omitempty"`
}

type IntelCVSS struct {
	Score   *float64 `json:"score,omitempty"`
	Version *string  `json:"version,omitempty"`
}

type IntelEPSS struct {
	Score      *float64 `json:"score,omitempty"`
	Percentile *float64 `json:"percentile,omitempty"`
}

type IntelReference struct {
	Title *string `json:"title,omitempty"`
	URL   string  `json:"url"`
}

type IntelDetail struct {
	Identifiers []string                   `json:"identifiers"`
	NVD         map[string]json.RawMessage `json:"nvd,omitempty"`
	EPSS        map[string]json.RawMessage `json:"epss,omitempty"`
	KEV         map[string]json.RawMessage `json:"kev,omitempty"`
	References  []IntelReference           `json:"references,omitempty"`
	UpdatedAt   *string                    `json:"updated_at,omitempty"`
}
