package v1

import (
	"encoding/json"
	"time"
)

type SbomComponentDTO struct {
	ID        string          `json:"id"`
	Purl      *string         `json:"purl,omitempty"`
	Name      string          `json:"name"`
	Version   *string         `json:"version,omitempty"`
	Ecosystem *string         `json:"ecosystem,omitempty"`
	Supplier  *string         `json:"supplier,omitempty"`
	Licenses  json.RawMessage `json:"licenses,omitempty"`
	Direct    bool            `json:"direct"`

	VulnTotal    int `json:"vulnTotal"`
	VulnCritical int `json:"vulnCritical"`
	VulnHigh     int `json:"vulnHigh"`
	VulnMedium   int `json:"vulnMedium"`
	VulnLow      int `json:"vulnLow"`
}

type SbomIndexStatusDTO struct {
	Status         string     `json:"status"`
	Error          *string    `json:"error,omitempty"`
	ComponentCount int        `json:"componentCount"`
	EdgeCount      int        `json:"edgeCount"`
	IndexedAt      *time.Time `json:"indexedAt,omitempty"`
}

// ---------- Transitive dependencies ----------

type SbomTransitiveStatusDTO struct {
	Status    string     `json:"status"`
	Error     *string    `json:"error,omitempty"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
}

type SbomTransitiveExposureDTO struct {
	ID        string  `json:"id"`
	Purl      *string `json:"purl,omitempty"`
	Name      string  `json:"name"`
	Version   *string `json:"version,omitempty"`
	Ecosystem *string `json:"ecosystem,omitempty"`

	CriticalCount int `json:"criticalCount"`
	HighCount     int `json:"highCount"`
	MediumCount   int `json:"mediumCount"`
	LowCount      int `json:"lowCount"`

	MaxCvssScore *float64 `json:"maxCvssScore,omitempty"`
	MaxEpssScore *float64 `json:"maxEpssScore,omitempty"`

	MinDistanceToAnyVuln *int `json:"minDistanceToAnyVuln,omitempty"`
}

type SbomPathNodeDTO struct {
	ID        string  `json:"id"`
	Purl      *string `json:"purl,omitempty"`
	Name      string  `json:"name"`
	Version   *string `json:"version,omitempty"`
	Ecosystem *string `json:"ecosystem,omitempty"`
}

type SbomPathDTO struct {
	Depth int               `json:"depth"`
	Nodes []SbomPathNodeDTO `json:"nodes"`
}
