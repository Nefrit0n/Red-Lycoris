package risk

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"strings"
	"time"
)

type ModelCalculator struct {
	Model RiskModel
}

func NewCalculator(model RiskModel) *ModelCalculator {
	return &ModelCalculator{Model: model}
}

func (c *ModelCalculator) Compute(ctx RiskContext) (Result, error) {
	normalized := normalizeContext(ctx, c.Model.Version)
	inputHash, err := hashInputs(normalized)
	if err != nil {
		return Result{}, err
	}

	inputs := RiskInputs{
		Severity:         normalized.Severity,
		CVSSScore:        normalized.CVSSScore,
		EPSSScore:        normalized.EPSSScore,
		KEV:              normalized.KEV,
		AssetCriticality: normalized.AssetCriticality,
		Environment:      normalized.Environment,
		InternetExposed:  normalized.InternetExposed,
		FirstSeenAt:      normalized.FirstSeenAt,
		Now:              normalized.LastSeenAt,
	}

	result := Calculate(c.Model, inputs)
	return Result{
		Score:        result.Score,
		Band:         result.Band,
		ModelVersion: result.ModelVersion,
		Factors:      result.Factors,
		InputHash:    inputHash,
	}, nil
}

type normalizedContext struct {
	ModelVersion     string    `json:"model_version"`
	Severity         string    `json:"severity"`
	Status           string    `json:"status"`
	Category         string    `json:"category"`
	Identifiers      []string  `json:"identifiers,omitempty"`
	AssetCriticality string    `json:"asset_criticality,omitempty"`
	Environment      string    `json:"environment,omitempty"`
	InternetExposed  bool      `json:"internet_exposed"`
	CVSSScore        *float64  `json:"cvss_score,omitempty"`
	EPSSScore        *float64  `json:"epss_score,omitempty"`
	KEV              bool      `json:"kev"`
	FirstSeenAt      time.Time `json:"first_seen_at,omitempty"`
	LastSeenAt       time.Time `json:"last_seen_at,omitempty"`
}

func normalizeContext(ctx RiskContext, modelVersion string) normalizedContext {
	identifiers := make([]string, 0, len(ctx.Identifiers))
	for _, identifier := range ctx.Identifiers {
		value := strings.TrimSpace(identifier)
		if value != "" {
			identifiers = append(identifiers, value)
		}
	}
	sort.Strings(identifiers)

	return normalizedContext{
		ModelVersion:     modelVersion,
		Severity:         strings.ToLower(strings.TrimSpace(ctx.Severity)),
		Status:           strings.ToLower(strings.TrimSpace(ctx.Status)),
		Category:         strings.ToUpper(strings.TrimSpace(ctx.Category)),
		Identifiers:      identifiers,
		AssetCriticality: strings.ToLower(strings.TrimSpace(ctx.AssetCriticality)),
		Environment:      strings.ToLower(strings.TrimSpace(ctx.Environment)),
		InternetExposed:  ctx.InternetExposed,
		CVSSScore:        ctx.CVSSScore,
		EPSSScore:        ctx.EPSSScore,
		KEV:              ctx.KEV,
		FirstSeenAt:      ctx.FirstSeenAt.UTC(),
		LastSeenAt:       ctx.LastSeenAt.UTC(),
	}
}

func hashInputs(ctx normalizedContext) (string, error) {
	payload, err := json.Marshal(ctx)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(payload)
	return hex.EncodeToString(hash[:]), nil
}
