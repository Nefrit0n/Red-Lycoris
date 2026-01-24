package risk

import (
	"testing"
	"time"
)

func TestRiskMonotonicWithEPSS(t *testing.T) {
	calculator := NewCalculator(DefaultModelV1())
	first := 0.2
	second := 0.6

	inputs := RiskContext{
		Severity:         "high",
		EPSSScore:        &first,
		AssetCriticality: "medium",
		Environment:      "prod",
		InternetExposed:  false,
	}
	low, err := calculator.Compute(inputs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	inputs.EPSSScore = &second
	high, err := calculator.Compute(inputs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if high.Score < low.Score {
		t.Fatalf("expected higher EPSS to increase risk (low=%.2f high=%.2f)", low.Score, high.Score)
	}
}

func TestRiskKEVBoostsLikelihood(t *testing.T) {
	calculator := NewCalculator(DefaultModelV1())
	base := 0.2

	inputs := RiskContext{
		Severity:         "medium",
		EPSSScore:        &base,
		AssetCriticality: "medium",
		Environment:      "prod",
		InternetExposed:  false,
	}

	noKEV, err := calculator.Compute(inputs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	inputs.KEV = true
	withKEV, err := calculator.Compute(inputs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if withKEV.Score <= noKEV.Score {
		t.Fatalf("expected KEV to increase risk (noKEV=%.2f withKEV=%.2f)", noKEV.Score, withKEV.Score)
	}
}

func TestRiskSeverityFallbackImpact(t *testing.T) {
	calculator := NewCalculator(DefaultModelV1())
	inputs := RiskContext{
		Severity:         "high",
		AssetCriticality: "low",
		Environment:      "dev",
		InternetExposed:  false,
		FirstSeenAt:      time.Now().Add(-10 * 24 * time.Hour),
		LastSeenAt:       time.Now(),
	}

	result, err := calculator.Compute(inputs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Factors.Impact.Value != 0.7 {
		t.Fatalf("expected severity fallback impact 0.7, got %.2f", result.Factors.Impact.Value)
	}
}

func TestRiskDeterministicHash(t *testing.T) {
	calculator := NewCalculator(DefaultModelV1())
	base := 0.3
	ctx := RiskContext{
		Severity:         "medium",
		Status:           "new",
		Category:         "SAST",
		Identifiers:      []string{"CVE-2024-1234", "CVE-2024-9999"},
		AssetCriticality: "high",
		Environment:      "prod",
		InternetExposed:  true,
		EPSSScore:        &base,
		KEV:              false,
		FirstSeenAt:      time.Unix(1700000000, 0),
		LastSeenAt:       time.Unix(1700000500, 0),
	}

	first, err := calculator.Compute(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	second, err := calculator.Compute(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if first.InputHash != second.InputHash {
		t.Fatalf("expected deterministic input hash, got %s and %s", first.InputHash, second.InputHash)
	}
	if first.Score != second.Score {
		t.Fatalf("expected deterministic score, got %.2f and %.2f", first.Score, second.Score)
	}
}
