// Package kev содержит доменную логику KEV-обогащения.
package kev

import "time"

// UrgencyTier — категория "насколько срочно чинить" по due_date CISA.
type UrgencyTier string

const (
	UrgencyOverdue    UrgencyTier = "overdue"  // дедлайн прошёл
	UrgencyImminent   UrgencyTier = "imminent" // < 7 дней
	UrgencyHigh       UrgencyTier = "high"     // 7-30 дней
	UrgencyNormal     UrgencyTier = "normal"   // 30-90 дней
	UrgencyLow        UrgencyTier = "low"      // > 90 дней
	UrgencyNoDeadline UrgencyTier = "no_deadline"
)

// ComputeUrgency вычисляет tier относительно now.
// now передаётся параметром для тестируемости.
func ComputeUrgency(dueDate *time.Time, now time.Time) (UrgencyTier, int) {
	if dueDate == nil {
		return UrgencyNoDeadline, 0
	}
	daysUntil := int(dueDate.Sub(now).Hours() / 24)
	switch {
	case daysUntil < 0:
		return UrgencyOverdue, daysUntil
	case daysUntil < 7:
		return UrgencyImminent, daysUntil
	case daysUntil < 30:
		return UrgencyHigh, daysUntil
	case daysUntil < 90:
		return UrgencyNormal, daysUntil
	default:
		return UrgencyLow, daysUntil
	}
}
