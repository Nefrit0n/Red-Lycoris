# Adding a scanner

This guide describes the end-to-end flow for integrating a new scanner while keeping the canonical data stable.

## Pipeline steps (detect → parse → normalize → map → persist)

### 1) Detect

**Goal:** Identify scanner type and schema version from the uploaded report.

**How:**
- Use file name hints plus a JSON/YAML header check.
- Extract `schemaVersion` when present.

**Example:**
- Trivy JSON: check `"SchemaVersion"` at root.
- Semgrep JSON: check `"version"` and `"results"`.

### 2) Parse

**Goal:** Validate and parse raw report into a minimal internal shape.

**How:**
- Parse only required fields (don’t normalize yet).
- Store the raw fragment for evidence.

**Example (Trivy SCA fragment):**
- `Results[*].Vulnerabilities[*]` with `VulnerabilityID`, `PkgName`, `InstalledVersion`, `FixedVersion`, `PkgPath`.

**Example (Semgrep SAST fragment):**
- `results[*]` with `check_id`, `path`, `start`, `end`, `message`, `extra.severity`.

### 3) Normalize

**Goal:** Convert scanner-specific fields into canonical fields.

**How:**
- Normalize severities to platform severity scale.
- Convert package names and versions to canonical form.
- Normalize locations (path + line range) for SAST.

**Example:**
- Trivy severity `CRITICAL` → canonical `critical`.
- Semgrep severity `ERROR` → canonical `high`.

### 4) Map

**Goal:** Map normalized fields into the canonical finding DTO.

**How:**
- Map `type` (`sca` vs `sast`).
- Assign identifiers (CVE/CWE/etc.).
- Set scanner + tool metadata.

**Example (Trivy SCA → canonical):**
- `type`: `sca`
- `scanner`: `trivy`
- `identifier`: `CVE-2023-1234`
- `package`: `openssl@3.0.8`
- `location`: `package-lock.json`

**Example (Semgrep SAST → canonical):**
- `type`: `sast`
- `scanner`: `semgrep`
- `rule_id`: `javascript.lang.security.audit.eval-used`
- `location`: `src/app.js:12-14`

### 5) Persist

**Goal:** Store evidence and upsert the canonical finding.

**How:**
- Persist evidence as append-only.
- Upsert finding by `(tenant_id, fingerprint)`.
- Emit import metrics (parsed/normalized/persisted).

## Fingerprint rules

**Goal:** Same issue → same fingerprint across imports.

**Rules:**
1. Always include `tenant_id` in the final key.
2. Use stable fields only (no timestamps or tool run IDs).
3. Include `scanner`, `type`, and the *normalized* location/identifier.

**Recommended components by type:**
- **SCA:** `scanner + package@version + identifier + location`.
- **SAST:** `scanner + rule_id + file_path + line_start + line_end`.

**Examples:**
- Trivy SCA:
  - `trivy|sca|openssl@3.0.8|CVE-2023-1234|package-lock.json`
- Semgrep SAST:
  - `semgrep|sast|javascript.lang.security.audit.eval-used|src/app.js|12|14`

## Fixtures + contract tests

**Fixtures requirements:**
- Store a **raw report** fixture and a **normalized output** fixture.
- Include both **SAST** and **SCA** examples.
- Keep fixtures small but realistic (1–3 findings each).

**Contract test requirements:**
- Validate that parsing succeeds for all fixtures.
- Assert normalization produces stable fingerprints.
- Ensure canonical DTO v1 schema validation passes.

**Suggested layout:**
- `contracts/fixtures/scanners/<scanner>/<version>/raw.json`
- `contracts/fixtures/scanners/<scanner>/<version>/normalized.json`

**Example fixture names:**
- `contracts/fixtures/scanners/trivy/v0.49/raw.json`
- `contracts/fixtures/scanners/semgrep/v1.77/raw.json`
