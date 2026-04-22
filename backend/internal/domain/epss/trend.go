package epss

import "time"

// Tier — категория EPSS risk в терминах FIRST.org (2024 thresholds).
type Tier string

const (
	TierMinimal  Tier = "minimal"  // < 1%
	TierLow      Tier = "low"      // 1% - 10%
	TierModerate Tier = "moderate" // 10% - 50%
	TierElevated Tier = "elevated" // 50% - 90%
	TierCritical Tier = "critical" // >= 90%
)

func ScoreTier(score float64) Tier {
	switch {
	case score >= 0.90:
		return TierCritical
	case score >= 0.50:
		return TierElevated
	case score >= 0.10:
		return TierModerate
	case score >= 0.01:
		return TierLow
	default:
		return TierMinimal
	}
}

// HistoryPoint — одна точка EPSS history для sparkline/trend-анализа.
type HistoryPoint struct {
	Date       time.Time `json:"date"`
	Score      float64   `json:"score"`
	Percentile float64   `json:"percentile"`
}

// TrendStats — сводка тренда для одного CVE.
type TrendStats struct {
	Trend7d  float64 `json:"trend_7d"`  // current - score_7d_ago
	Trend30d float64 `json:"trend_30d"` // current - score_30d_ago
	Peak90d  float64 `json:"peak_90d"`  // max score за 90 дней
	IsRising bool    `json:"is_rising"` // true если trend_7d > 0.10
}

// ComputeTrend считает сводку тренда на основании истории.
// points должны быть отсортированы по возрастанию даты.
// Если точек меньше минимально необходимого — возвращается
// TrendStats с нулями (это нормально, просто нет данных).
func ComputeTrend(points []HistoryPoint) TrendStats {
	if len(points) == 0 {
		return TrendStats{}
	}

	current := points[len(points)-1]
	stats := TrendStats{Peak90d: current.Score}

	for _, p := range points {
		if p.Score > stats.Peak90d {
			stats.Peak90d = p.Score
		}
	}

	cutoff7 := current.Date.AddDate(0, 0, -7)
	cutoff30 := current.Date.AddDate(0, 0, -30)
	found7 := false
	found30 := false

	for i := len(points) - 1; i >= 0; i-- {
		p := points[i]
		if !found7 && !p.Date.After(cutoff7) {
			stats.Trend7d = current.Score - p.Score
			found7 = true
		}
		if !found30 && !p.Date.After(cutoff30) {
			stats.Trend30d = current.Score - p.Score
			found30 = true
			break
		}
	}

	stats.IsRising = stats.Trend7d > 0.10
	return stats
}
