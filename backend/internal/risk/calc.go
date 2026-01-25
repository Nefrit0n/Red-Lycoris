package risk

import (
	"math"
	"strings"
)

func Calculate(model RiskModel, inputs RiskInputs) RiskResult {
	impact, impactFactor := calculateImpact(inputs)
	likelihood, likelihoodFactor := calculateLikelihood(inputs, model.Weights)
	assetMultiplier, assetFactor := calculateAssetMultiplier(inputs, model.Weights)
	freshnessMultiplier, freshnessFactor := calculateFreshnessMultiplier(inputs, model.Weights)

	weighted := (model.Weights.ImpactWeight * impact) + (model.Weights.LikelihoodWeight * likelihood)
	rawScore := weighted * assetMultiplier * freshnessMultiplier
	score := 100 * clamp01(rawScore)

	return RiskResult{
		Score:        round(score, 2),
		Band:         bandForScore(score),
		ModelVersion: model.Version,
		Factors: RiskFactors{
			Impact:     impactFactor,
			Likelihood: likelihoodFactor,
			Asset:      assetFactor,
			Freshness:  freshnessFactor,
		},
	}
}

func calculateImpact(inputs RiskInputs) (float64, ImpactFactor) {
	if inputs.CVSSScore != nil {
		impact := clamp01(*inputs.CVSSScore / 10.0)
		return impact, ImpactFactor{
			CVSSScore: inputs.CVSSScore,
			Value:     impact,
		}
	}
	impact := severityImpact(inputs.Severity)
	return impact, ImpactFactor{
		Severity: inputs.Severity,
		Value:    impact,
	}
}

func calculateLikelihood(inputs RiskInputs, weights RiskWeights) (float64, LikelihoodFactor) {
	likelihood := 0.0
	known := false
	reason := "no_epss_or_kev"
	if inputs.EPSSScore != nil {
		likelihood = clamp01(*inputs.EPSSScore)
		known = true
		reason = "epss"
	}
	if inputs.KEV && weights.KevFloor > 0 {
		likelihood = math.Max(likelihood, weights.KevFloor)
		known = true
		reason = "kev"
	}
	return likelihood, LikelihoodFactor{
		EPSSScore: inputs.EPSSScore,
		KEV:       inputs.KEV,
		Value:     likelihood,
		Known:     known,
		Reason:    reason,
	}
}

func calculateAssetMultiplier(inputs RiskInputs, weights RiskWeights) (float64, AssetFactor) {
	criticality := stringsNormalized(inputs.AssetCriticality)
	assetMultiplier := weights.AssetCriticalityMultipliers[criticality]
	if assetMultiplier == 0 {
		assetMultiplier = 1.0
	}
	environment := stringsNormalized(inputs.Environment)
	envMultiplier := weights.EnvironmentMultipliers[environment]
	if envMultiplier == 0 {
		envMultiplier = 1.0
	}
	exposureMultiplier := 1.0
	if inputs.InternetExposed && weights.InternetExposedMultiplier > 0 {
		exposureMultiplier = weights.InternetExposedMultiplier
	}
	return assetMultiplier * envMultiplier * exposureMultiplier, AssetFactor{
		Criticality:           inputs.AssetCriticality,
		Multiplier:            assetMultiplier,
		Environment:           inputs.Environment,
		EnvironmentMultiplier: envMultiplier,
		InternetExposed:       inputs.InternetExposed,
		ExposureMultiplier:    exposureMultiplier,
	}
}

func calculateFreshnessMultiplier(inputs RiskInputs, weights RiskWeights) (float64, FreshnessFactor) {
	if weights.FreshnessWeight <= 0 || inputs.FirstSeenAt.IsZero() || inputs.Now.IsZero() {
		return 1.0, FreshnessFactor{Enabled: false, AgeDays: 0, Multiplier: 1.0}
	}
	ageDays := inputs.Now.Sub(inputs.FirstSeenAt).Hours() / 24
	if ageDays < 0 {
		ageDays = 0
	}
	maxDays := weights.FreshnessMaxDays
	if maxDays <= 0 {
		maxDays = 90
	}
	normalized := clamp01(ageDays / maxDays)
	multiplier := 1.0 + (weights.FreshnessWeight * normalized)
	return multiplier, FreshnessFactor{Enabled: true, AgeDays: ageDays, Multiplier: multiplier}
}

func bandForScore(score float64) string {
	switch {
	case score < 20:
		return "low"
	case score < 50:
		return "medium"
	case score < 80:
		return "high"
	default:
		return "critical"
	}
}

func clamp01(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func round(value float64, precision int) float64 {
	if precision <= 0 {
		return math.Round(value)
	}
	factor := math.Pow(10, float64(precision))
	return math.Round(value*factor) / factor
}

func stringsNormalized(value string) string {
	if value == "" {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(value))
}
