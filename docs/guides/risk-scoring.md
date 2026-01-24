# Risk Scoring (Phase 2.1)

## Risk vs. Severity

* **Severity** is an input classification from scanners or analysts (low/medium/high/critical).
* **Risk** is a **business-aware, explainable score (0..100)** that combines impact, likelihood, and asset context.

Risk is designed to be **deterministic**: the same inputs produce the same score.

## Inputs

We only use inputs that already exist in the system:

* **Impact**
  * `cvss_score` from `vuln_intel` if present.
  * Otherwise, fallback to severity map: `critical=1.0`, `high=0.7`, `medium=0.4`, `low=0.1`.
* **Likelihood**
  * `epss_score` (0..1) from `vuln_intel` if present.
  * If `kev=true`, apply a **KEV floor** to ensure known-exploited vulns are always high likelihood.
* **Asset**
  * `products.asset_criticality` (low/medium/high/critical).
  * `product_asset_context` (optional): `environment` and `internet_exposed` influence a multiplier.
* **Freshness / exposure (optional)**
  * A separate weight applies a multiplier when a finding stays open longer.
  * Weight defaults to **0.0** (disabled) in v1.

## Formula (Risk Model v1)

We use a **weighted sum** for interpretability and monotonicity:

```
impact = cvss_score/10 OR severity_fallback
likelihood = epss_score
if kev: likelihood = max(likelihood, kev_floor)

base = (wI * impact + wL * likelihood)
score = 100 * clamp01(base * asset_multiplier * exposure_multiplier * freshness_multiplier)
```

**Trade-off:** A weighted sum is easier to explain than power/exponent models, remains monotonic in each input, and is easy to tune without unexpected jumps.

## Default Weights (v1)

* `wI = 0.6`, `wL = 0.4`
* `kev_floor = 0.9`
* Asset criticality multipliers:
  * low: `0.8`
  * medium: `1.0`
  * high: `1.2`
  * critical: `1.4`
* Asset context multipliers:
  * `environment=prod`: `1.1`
  * `environment=staging`: `1.0`
  * `environment=dev`: `0.9`
  * `environment=unknown`: `1.0`
  * `internet_exposed=true`: `1.2`
* Freshness multiplier (optional):
  * `freshness_weight = 0.0` (disabled)
  * `freshness_max_days = 90`

## Bands

| Score | Band |
| --- | --- |
| < 20 | low |
| < 50 | medium |
| < 80 | high |
| >= 80 | critical |

## Explainability

Each score returns JSON factors with inputs and multipliers:

* `impact`: source values (`cvss_score` or `severity`) and impact value
* `likelihood`: `epss_score`, `kev` flag, and likelihood value
* `asset`: `asset_criticality`, `environment`, `internet_exposed`, and multipliers
* `freshness`: whether enabled, age in days, and multiplier

## Model Versioning

We store models in `risk_models`:

* `version` identifies the scoring logic (e.g., `v1`).
* `weights` stores the full weight set used to compute scores.
* `is_active` indicates the currently applied model per tenant.

This prevents “silent” weight changes and allows historical re-scoring.

## Event Subjects

Risk recomputation is requested via a stable, intent-driven subject namespace:

* `finding.risk.recompute.requested.v1`

The subject is versioned and supports durable JetStream consumers with filtered subjects so multiple worker instances can share a single durable consumer for load balancing.
