package epss

import (
	"math"
	"testing"
	"time"
)

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < 0.00001
}

func TestComputeTrend_EmptyInput(t *testing.T) {
	stats := ComputeTrend(nil)

	if stats != (TrendStats{}) {
		t.Fatalf("expected zero stats, got %+v", stats)
	}
}

func TestComputeTrend_OnePoint(t *testing.T) {
	points := []HistoryPoint{{Date: time.Date(2026, 4, 16, 0, 0, 0, 0, time.UTC), Score: 0.27, Percentile: 0.8}}
	stats := ComputeTrend(points)

	if !almostEqual(stats.Peak90d, 0.27) {
		t.Fatalf("expected peak 0.27, got %v", stats.Peak90d)
	}
	if stats.Trend7d != 0 || stats.Trend30d != 0 || stats.IsRising {
		t.Fatalf("expected no trends and not rising, got %+v", stats)
	}
}

func TestComputeTrend_StableScore(t *testing.T) {
	start := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	points := []HistoryPoint{
		{Date: start, Score: 0.2},
		{Date: start.AddDate(0, 0, 7), Score: 0.2},
		{Date: start.AddDate(0, 0, 30), Score: 0.2},
	}
	stats := ComputeTrend(points)

	if stats.Trend7d != 0 || stats.Trend30d != 0 || stats.IsRising {
		t.Fatalf("expected stable zero trends, got %+v", stats)
	}
}

func TestComputeTrend_RisingIn7Days(t *testing.T) {
	current := time.Date(2026, 4, 16, 0, 0, 0, 0, time.UTC)
	points := []HistoryPoint{
		{Date: current.AddDate(0, 0, -14), Score: 0.01},
		{Date: current.AddDate(0, 0, -7), Score: 0.02},
		{Date: current, Score: 0.45},
	}
	stats := ComputeTrend(points)

	if !almostEqual(stats.Trend7d, 0.43) {
		t.Fatalf("expected trend7d ≈ 0.43, got %v", stats.Trend7d)
	}
	if !stats.IsRising {
		t.Fatalf("expected rising true, got false")
	}
}

func TestComputeTrend_FallingIn7Days(t *testing.T) {
	current := time.Date(2026, 4, 16, 0, 0, 0, 0, time.UTC)
	points := []HistoryPoint{
		{Date: current.AddDate(0, 0, -7), Score: 0.50},
		{Date: current, Score: 0.05},
	}
	stats := ComputeTrend(points)

	if !almostEqual(stats.Trend7d, -0.45) {
		t.Fatalf("expected trend7d ≈ -0.45, got %v", stats.Trend7d)
	}
	if stats.IsRising {
		t.Fatalf("expected rising false, got true")
	}
}

func TestComputeTrend_PeakInMiddle(t *testing.T) {
	current := time.Date(2026, 4, 16, 0, 0, 0, 0, time.UTC)
	points := []HistoryPoint{
		{Date: current.AddDate(0, 0, -30), Score: 0.15},
		{Date: current.AddDate(0, 0, -20), Score: 0.77},
		{Date: current.AddDate(0, 0, -10), Score: 0.30},
		{Date: current, Score: 0.40},
	}
	stats := ComputeTrend(points)

	if !almostEqual(stats.Peak90d, 0.77) {
		t.Fatalf("expected peak 0.77, got %v", stats.Peak90d)
	}
}
