# Vulnerability intelligence (intel) guide

## Sources and contract

Lotus Warden enriches vulnerability identifiers using three “official” sources:

- **NVD** (NIST): CVSS scores and references.
- **EPSS** (FIRST): exploit probability score and percentile.
- **CISA KEV**: known exploited vulnerabilities list.

Only **CVE identifiers** are enriched. Non‑CVE identifiers (GHSA/OSV/CWE, etc.) are stored on findings, but intel enrichment is **skipped** (not an error). This keeps the ingestion pipeline flexible while clearly defining which identifiers are currently supported.

### Canonical fields for scoring

These fields are considered canonical and should remain stable for future scoring logic (e.g., `risk_score`):

- `cvss_score`
- `epss_score`
- `epss_percentile`
- `kev` (boolean)
- `last_refreshed_at`

All provider payloads (`nvd_payload`, `epss_payload`, `kev_payload`, `references_payload`) are stored as JSONB for future use without migrations.

## Configuration (environment variables)

Intel behavior is configured via env vars (see `backend/internal/config/config.go`):

- `NVD_API_KEY`: optional NVD API key for higher rate limits.
- `EPSS_ENABLED`: enable/disable EPSS (default `true`).
- `KEV_URL`: override KEV primary source URL.
- `KEV_MIRROR_URL`: optional KEV mirror URL for fallback.
- `INTEL_REFRESH_INTERVAL`: how often to refresh intel (default `24h`).
- `INTEL_WORKER_CONCURRENCY`: concurrency for provider requests (default `4`).
- `INTEL_RETRY_BASE`: base duration for retry backoff (default `30m`).

## Refresh and retry policy

- **Refresh**: each identifier is refreshed when `last_refreshed_at + INTEL_REFRESH_INTERVAL` has elapsed.
- **Retry**: failures use exponential backoff with jitter:

```
next_retry_at = now + INTEL_RETRY_BASE * 2^min(fail_count, cap) + jitter
```

Where:
- `fail_count` increments on each consecutive failure.
- `cap` limits growth (current cap is 6).
- `jitter` is a randomized additive delay up to `INTEL_RETRY_BASE`.

On a successful refresh, `fail_count` resets to 0 and `next_retry_at` is cleared.

## Manual refresh API

You can manually queue intel refresh via:

```
POST /api/v1/intel/refresh
```

Example payloads:

- Refresh specific identifiers:

```json
{ "identifiers": ["CVE-2024-0001", "CVE-2023-1234"] }
```

- Refresh recent identifiers for a product:

```json
{ "product_id": "<product-uuid>" }
```

Expected response:

```json
{ "success": true, "data": { "queued": 42 } }
```

This endpoint only queues jobs; the intel worker will process them asynchronously.
