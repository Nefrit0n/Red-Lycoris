package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type ProjectStatus string

const (
	ProjectStatusActive   ProjectStatus = "active"
	ProjectStatusPaused   ProjectStatus = "paused"
	ProjectStatusArchived ProjectStatus = "archived"
)

type ScannerState string

const (
	ScannerStateOK      ScannerState = "ok"
	ScannerStateMissing ScannerState = "missing"
	ScannerStateOff     ScannerState = "off"
)

type ProjectHealth string

const (
	ProjectHealthHealthy ProjectHealth = "healthy"
	ProjectHealthWarn    ProjectHealth = "warn"
	ProjectHealthBreach  ProjectHealth = "breach"
	ProjectHealthSetup   ProjectHealth = "setup"
	ProjectHealthPaused  ProjectHealth = "paused"
)

type ProjectOwner struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
}

type ProjectTeam struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ProjectFindingsBySeverity struct {
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Info     int `json:"info"`
}

type ProjectScanners struct {
	SAST    ScannerState `json:"sast"`
	DAST    ScannerState `json:"dast"`
	SCA     ScannerState `json:"sca"`
	Secrets ScannerState `json:"secrets"`
}

type ProjectLastScan struct {
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Status     string     `json:"status"`
}

type Project struct {
	ID                  uuid.UUID                 `json:"id"`
	Slug                string                    `json:"slug"`
	Name                string                    `json:"name"`
	Description         string                    `json:"description,omitempty"`
	IconColor           string                    `json:"icon_color"`
	RepoURL             string                    `json:"repo_url,omitempty"`
	RepoProvider        string                    `json:"repo_provider,omitempty"`
	Tags                []string                  `json:"tags"`
	Status              ProjectStatus             `json:"status"`
	SetupCompleted      bool                      `json:"setup_completed"`
	Visibility          string                    `json:"visibility"`
	Owner               ProjectOwner              `json:"owner"`
	Team                *ProjectTeam              `json:"team,omitempty"`
	Pinned              bool                      `json:"pinned"`
	CreatedBy           uuid.UUID                 `json:"-"`
	FindingsBySev       ProjectFindingsBySeverity `json:"findings_by_severity"`
	SLABreached         int                       `json:"sla_breached_count"`
	SLACriticalDays     *int                      `json:"sla_critical_days,omitempty"`
	SLAHighDays         *int                      `json:"sla_high_days,omitempty"`
	SLAMediumDays       *int                      `json:"sla_medium_days,omitempty"`
	SLALowDays          *int                      `json:"sla_low_days,omitempty"`
	SLANotifyBeforeDays int                       `json:"sla_notify_before_days"`
	Scanners            ProjectScanners           `json:"scanners"`
	LastScan            *ProjectLastScan          `json:"last_scan,omitempty"`
	Health              ProjectHealth             `json:"health"`
	CreatedAt           time.Time                 `json:"created_at"`
	UpdatedAt           time.Time                 `json:"updated_at"`
}

func (p *Project) Validate() error {
	if p.Name == "" {
		return errors.New("name is required")
	}
	if len(p.Name) > 255 {
		return errors.New("name must be 255 characters or less")
	}
	return nil
}
