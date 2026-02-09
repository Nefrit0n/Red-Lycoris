package sla

import (
	"math"
	"strings"
	"time"

	"red-lycoris/backend/internal/config"
	"red-lycoris/backend/internal/models"
)

type Matrix struct {
	Critical time.Duration
	High     time.Duration
	Medium   time.Duration
	Low      time.Duration
}

const (
	DefaultProfile = "default"
	DefaultSource  = "default_matrix"
)

func DefaultMatrix() Matrix {
	return Matrix{
		Critical: 7 * 24 * time.Hour,
		High:     30 * 24 * time.Hour,
		Medium:   90 * 24 * time.Hour,
		Low:      180 * 24 * time.Hour,
	}
}

func MatrixFromConfig(cfg config.Config) Matrix {
	matrix := DefaultMatrix()
	if parsed, err := time.ParseDuration(cfg.SLACriticalDuration); err == nil {
		matrix.Critical = parsed
	}
	if parsed, err := time.ParseDuration(cfg.SLAHighDuration); err == nil {
		matrix.High = parsed
	}
	if parsed, err := time.ParseDuration(cfg.SLAMediumDuration); err == nil {
		matrix.Medium = parsed
	}
	if parsed, err := time.ParseDuration(cfg.SLALowDuration); err == nil {
		matrix.Low = parsed
	}
	return matrix
}

func DurationForSeverity(severity string, matrix Matrix) (time.Duration, bool) {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		return matrix.Critical, true
	case "high":
		return matrix.High, true
	case "medium":
		return matrix.Medium, true
	case "low":
		return matrix.Low, true
	default:
		return 0, false
	}
}

func DueAt(firstSeen time.Time, severity string, matrix Matrix) (time.Time, bool) {
	duration, ok := DurationForSeverity(severity, matrix)
	if !ok {
		return time.Time{}, false
	}
	return firstSeen.Add(duration), true
}

func ShouldUpdateDueAt(existing *time.Time, candidate time.Time) bool {
	if existing == nil {
		return true
	}
	return candidate.Before(*existing)
}

func DaysRemaining(dueAt *time.Time, now time.Time) *int {
	if dueAt == nil {
		return nil
	}
	remaining := int(math.Ceil(dueAt.Sub(now).Hours() / 24))
	return &remaining
}

func IsBreached(dueAt *time.Time, status string, now time.Time) bool {
	if dueAt == nil {
		return false
	}
	if !now.After(*dueAt) {
		return false
	}
	return !isClosedStatus(status)
}

func isClosedStatus(status string) bool {
	return models.IsClosedFindingStatus(status)
}

func SeverityRank(severity string) int {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}
