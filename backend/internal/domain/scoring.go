package domain

import "math"

// CalculatePriorityScore computes a normalized 0–10 priority score.
//
// Formula from CLAUDE.md:
//
//	raw = cvss_base*0.30 + epss*100*0.25 + kev*10*0.20 + bdu*5*0.10 + recency*0.10 + exposure*0.05
//
// recency = 10 * exp(-daysOld / 365)
// exposure is fixed at 5 (mid-range default, configurable per-deployment).
// Maximum theoretical raw ≈ 10*0.30 + 100*0.25 + 10*0.20 + 5*0.10 + 10*0.10 + 10*0.05 = 33.0
// We normalize by dividing by maxRaw and scaling to 10.
func CalculatePriorityScore(baseScore, epssScore float64, isKEV, isBDU bool, daysOld float64) float64 {
	const exposure = 5.0
	const maxRaw = 33.0

	var kevVal float64
	if isKEV {
		kevVal = 10.0
	}
	var bduVal float64
	if isBDU {
		bduVal = 5.0
	}

	recency := 10.0 * math.Exp(-daysOld/365.0)

	raw := baseScore*0.30 +
		epssScore*100.0*0.25 +
		kevVal*0.20 +
		bduVal*0.10 +
		recency*0.10 +
		exposure*0.05

	score := (raw / maxRaw) * 10.0

	return math.Min(10.0, math.Max(0.0, math.Round(score*100)/100))
}
