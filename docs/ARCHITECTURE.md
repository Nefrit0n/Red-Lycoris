# Architecture guide

This document defines the domain boundaries and system-level principles that keep new scanners, new finding fields, and new report formats from breaking the platform.

## Domain boundaries

### 1) Canonical finding (source of truth)

**Goal:** A stable, normalized representation of a security finding that can survive new scanners and versions.

**Owns:**
- Finding identity (fingerprint), lifecycle state, severity, and normalized fields.
- Cross-tool enrichment hooks (CVSS/EPSS/KEV) and deduplication.

**Does not own:** raw evidence, scanner-specific fields, or analytics-only projections.

**Example:**
- `scanner`: `trivy`
- `type`: `sca`
- `title`: `openssl: CVE-2023-1234`
- `package`: `openssl@3.0.8`
- `location`: `package-lock.json`

### 2) Evidence (immutable raw + parsed fragments)

**Goal:** Preserve exactly what the scanner reported, plus minimal parsed fragments to reproduce the canonical finding.

**Owns:**
- Raw report or extracted snippet.
- Pointer back to import job + artifact.
- Minimal parsed JSON that can be re-normalized.

**Does not own:** normalized fields, dedupe decisions, or analytics-only state.

**Example:**
- `raw_data`: Trivy JSON record from `Results[*].Vulnerabilities[*]`.
- `evidence_metadata`: `{"reportPath":"trivy.json","artifactSha256":"..."}`

### 3) Analytics/Search (derived views)

**Goal:** Fast queries and aggregations without mutating canonical findings.

**Owns:**
- Materialized views, search indexes, and rollups.
- Schema optimized for filter/search/UI.

**Does not own:** raw evidence or canonical data; rebuildable from canonical + evidence.

**Example:**
- Search index document with denormalized product name and tags.

## Core principles

### Idempotency

**Rule:** Importing the same report multiple times must not create duplicates.

**How:**
- Always compute a stable fingerprint during normalization.
- Upsert canonical findings by `(tenant_id, fingerprint)`.
- Evidence is append-only; findings are upserted.

**Example:** Two Trivy scans for the same image with identical package path and CVE must resolve to the same finding.

### Backpressure

**Rule:** High-volume imports must not overload downstream workers.

**How:**
- Use queue depth + rate limits per tenant.
- Batch persistence of findings/evidence.
- Reject or delay oversized uploads; emit a retryable status.

**Example:** If `analysis-worker` backlog grows past threshold, pause accepting new `upload` jobs for that tenant.

### Observability

**Rule:** Every import must be traceable end-to-end.

**How:**
- Tag logs with `tenant_id`, `import_job_id`, and `scanner`.
- Emit counters for parsed/normalized/persisted counts.
- Record normalization errors without failing the entire import.

**Example:** Log `normalized=120 persisted=118 rejected=2` with reasons.

### Multi-tenancy

**Rule:** Tenant data must be isolated by default.

**How:**
- All persistence and search queries must be scoped by `tenant_id`.
- Fingerprints and cache keys must include `tenant_id`.
- Aggregations must not cross tenants.

**Example:** A global CVE rollup must still be filtered per tenant in API responses.

## Related guides

- [Adding a scanner](guides/adding-scanner.md)
- [Evolving DTO v1](guides/evolving-dto-v1.md)
- [Report versions](guides/report-versions.md)
