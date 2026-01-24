package risk

import (
	"testing"
	"time"
)

func TestRiskMonotonicWithEPSS(t *testing.T) {
	model := DefaultModelV1()
	first := 0.2
	second := 0.6

	inputs := RiskInputs{
		Severity:         "high",
		EPSSScore:        &first,
		AssetCriticality: "medium",
		Environment:      "prod",
		InternetExposed:  false,
	}
	low := Calculate(model, inputs)
	inputs.EPSSScore = &second
	high := Calculate(model, inputs)

	if high.Score < low.Score {
		t.Fatalf("expected higher EPSS to increase risk (low=%.2f high=%.2f)", low.Score, high.Score)
	}
}

func TestRiskKEVBoostsLikelihood(t *testing.T) {
	model := DefaultModelV1()
	base := 0.2

	inputs := RiskInputs{
		Severity:         "medium",
		EPSSScore:        &base,
		AssetCriticality: "medium",
		Environment:      "prod",
		InternetExposed:  false,
	}

	noKEV := Calculate(model, inputs)
	inputs.KEV = true
	withKEV := Calculate(model, inputs)

	if withKEV.Score <= noKEV.Score {
		t.Fatalf("expected KEV to increase risk (noKEV=%.2f withKEV=%.2f)", noKEV.Score, withKEV.Score)
	}
}

func TestRiskSeverityFallbackImpact(t *testing.T) {
	model := DefaultModelV1()
	inputs := RiskInputs{
		Severity:         "high",
		AssetCriticality: "low",
		Environment:      "dev",
		InternetExposed:  false,
		FirstSeenAt:      time.Now().Add(-10 * 24 * time.Hour),
		Now:              time.Now(),
	}

	result := Calculate(model, inputs)
	if result.Factors.Impact.Value != 0.7 {
		t.Fatalf("expected severity fallback impact 0.7, got %.2f", result.Factors.Impact.Value)
	}
}
