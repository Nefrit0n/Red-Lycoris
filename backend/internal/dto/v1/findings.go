package v1

import "encoding/json"

type Finding struct {
	ID             string        `json:"id"`
	Title          string        `json:"title"`
	Description    *string       `json:"description,omitempty"`
	Fingerprint    *string       `json:"fingerprint,omitempty"`
	Severity       string        `json:"severity"`
	Status         string        `json:"status"`
	ScannerType    *string       `json:"scannerType,omitempty"`
	SourceType     *string       `json:"sourceType,omitempty"`
	SourceVersion  *string       `json:"sourceVersion,omitempty"`
	EndpointMethod *string       `json:"endpointMethod,omitempty"`
	EndpointPath   *string       `json:"endpointPath,omitempty"`
	Occurrence     *string       `json:"occurrenceStatus,omitempty"`
	FirstSeenAt    *string       `json:"firstSeenAt,omitempty"`
	LastSeenAt     *string       `json:"lastSeenAt,omitempty"`
	RepeatCount    *int          `json:"repeatCount,omitempty"`
	ProductID      *string       `json:"productId,omitempty"`
	ProductName    *string       `json:"productName,omitempty"`
	AssigneeID     *string       `json:"assigneeId,omitempty"`
	Owner          *Owner        `json:"owner,omitempty"`
	ImportJobID    *string       `json:"importJobId,omitempty"`
	CreatedAt      string        `json:"createdAt"`
	UpdatedAt      string        `json:"updatedAt"`
	DeletedAt      *string       `json:"deletedAt,omitempty"`
	IntelSummary   *IntelSummary `json:"intel_summary,omitempty"`
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

type FindingDetail struct {
	Finding
	Comments     []FindingComment       `json:"comments"`
	Events       []FindingEvent         `json:"events"`
	Occurrences  []FindingOccurrence    `json:"occurrences"`
	Duplicates   *DuplicateGroup        `json:"duplicates,omitempty"`
	Evidence     map[string]interface{} `json:"evidence,omitempty"`
	IntelDetails *IntelDetail           `json:"intel_details,omitempty"`
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
