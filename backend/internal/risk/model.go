package risk

import (
	"strings"
	"time"
)

type RiskModel struct {
	Version string
	Name    string
	Weights RiskWeights
}

type RiskWeights struct {
	ImpactWeight     float64
	LikelihoodWeight float64
	KevFloor         float64

	AssetCriticalityMultipliers map[string]float64
	EnvironmentMultipliers      map[string]float64
	InternetExposedMultiplier   float64

	FreshnessWeight  float64
	FreshnessMaxDays float64
}

type RiskInputs struct {
	Severity         string
	CVSSScore        *float64
	EPSSScore        *float64
	KEV              bool
	AssetCriticality string
	Environment      string
	InternetExposed  bool
	FirstSeenAt      time.Time
	Now              time.Time
}

type RiskContext struct {
	Severity         string
	Status           string
	Category         string
	Identifiers      []string
	AssetCriticality string
	Environment      string
	InternetExposed  bool
	CVSSScore        *float64
	EPSSScore        *float64
	KEV              bool
	FirstSeenAt      time.Time
	LastSeenAt       time.Time
}

type ImpactFactor struct {
	CVSSScore *float64 `json:"cvss_score,omitempty"`
	Severity  string   `json:"severity,omitempty"`
	Value     float64  `json:"value"`
}

type LikelihoodFactor struct {
	EPSSScore *float64 `json:"epss_score,omitempty"`
	KEV       bool     `json:"kev"`
	Value     float64  `json:"value"`
}

type AssetFactor struct {
	Criticality           string  `json:"criticality,omitempty"`
	Multiplier            float64 `json:"multiplier"`
	Environment           string  `json:"environment,omitempty"`
	EnvironmentMultiplier float64 `json:"environment_multiplier"`
	InternetExposed       bool    `json:"internet_exposed"`
	ExposureMultiplier    float64 `json:"exposure_multiplier"`
}

type FreshnessFactor struct {
	Enabled    bool    `json:"enabled"`
	AgeDays    float64 `json:"age_days"`
	Multiplier float64 `json:"multiplier"`
}

type RiskFactors struct {
	Impact     ImpactFactor     `json:"impact"`
	Likelihood LikelihoodFactor `json:"likelihood"`
	Asset      AssetFactor      `json:"asset"`
	Freshness  FreshnessFactor  `json:"freshness"`
}

type RiskResult struct {
	Score        float64     `json:"score"`
	Band         string      `json:"band"`
	ModelVersion string      `json:"model_version"`
	Factors      RiskFactors `json:"factors"`
}

type Result struct {
	Score        float64     `json:"score"`
	Band         string      `json:"band"`
	ModelVersion string      `json:"model_version"`
	Factors      RiskFactors `json:"factors"`
	InputHash    string      `json:"input_hash"`
}

type Calculator interface {
	Compute(ctx RiskContext) (Result, error)
}

func DefaultModelV1() RiskModel {
	return RiskModel{
		Version: "v1",
		Name:    "Risk Score Model v1",
		Weights: RiskWeights{
			ImpactWeight:     0.6,
			LikelihoodWeight: 0.4,
			KevFloor:         0.9,
			AssetCriticalityMultipliers: map[string]float64{
				"low":      0.8,
				"medium":   1.0,
				"high":     1.2,
				"critical": 1.4,
			},
			EnvironmentMultipliers: map[string]float64{
				"prod":    1.1,
				"staging": 1.0,
				"dev":     0.9,
				"unknown": 1.0,
			},
			InternetExposedMultiplier: 1.2,
			FreshnessWeight:           0.0,
			FreshnessMaxDays:          90,
		},
	}
}

var severityImpactMap = map[string]float64{
	"critical": 1.0,
	"high":     0.7,
	"medium":   0.4,
	"low":      0.1,
}

func severityImpact(severity string) float64 {
	value := severityImpactMap[strings.ToLower(strings.TrimSpace(severity))]
	if value == 0 {
		return 0.1
	}
	return value
}
