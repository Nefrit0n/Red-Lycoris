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
