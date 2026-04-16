package domain

import "math"

// CalculatePriorityScore computes a normalized 0–10 priority score.
//
// Formula from CLAUDE.md:
//
//	raw = cvss_base*0.30 + epss*100*0.25 + (kev_bonus+urgency_bonus)*0.20 + bdu*5*0.10 + recency*0.10 + exposure*0.05 + trend*0.05
//
// recency = 10 * exp(-daysOld / 365)
// exposure is fixed at 5 (mid-range default, configurable per-deployment).
// Maximum theoretical raw ≈ 10*0.30 + 100*0.25 + 10*0.20 + 5*0.10 + 10*0.10 + 10*0.05 + 5*0.05 = 33.25
// We normalize by dividing by maxRaw and scaling to 10.
func CalculatePriorityScore(
	baseScore, epssScore, epssTrend7d float64,
	isKEV bool,
	kevRansomware bool,
	daysUntilKevDue int,
	isBDU bool,
	daysOld float64,
) float64 {
	const exposure = 5.0
	const maxRaw = 33.25

	kevBonus := 0.0
	if isKEV {
		kevBonus = 10.0
	}
	if kevRansomware {
		kevBonus += 5.0
	}

	urgencyBonus := 0.0
	switch {
	case daysUntilKevDue < 0 && isKEV:
		urgencyBonus = 7.0
	case daysUntilKevDue < 7 && isKEV:
		urgencyBonus = 5.0
	case daysUntilKevDue < 30 && isKEV:
		urgencyBonus = 3.0
	case daysUntilKevDue < 90 && isKEV:
		urgencyBonus = 1.0
	}

	var bduVal float64
	if isBDU {
		bduVal = 5.0
	}

	recency := 10.0 * math.Exp(-daysOld/365.0)
	trendBonus := 0.0
	if epssTrend7d > 0.10 {
		trendBonus = 5.0
	}

	raw := baseScore*0.30 +
		epssScore*100.0*0.25 +
		(kevBonus+urgencyBonus)*0.20 +
		bduVal*0.10 +
		recency*0.10 +
		exposure*0.05 +
		trendBonus*0.05

	score := (raw / maxRaw) * 10.0

	return math.Min(10.0, math.Max(0.0, math.Round(score*100)/100))
}
