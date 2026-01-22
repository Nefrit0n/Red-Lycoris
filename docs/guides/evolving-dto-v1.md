# Evolving DTO v1

This guide defines compatibility rules for the canonical finding DTO v1.

## Non-breaking changes (allowed in v1)

**Rule:** Existing clients must continue to parse responses without changes.

**Allowed examples:**
- **Add a new optional field** with a safe default.
  - Example: add `finding.confidence` with default `"medium"`.
- **Extend enum** with a new value **only if** clients already treat unknown values safely.
  - Example: add `severity=informational` while existing clients fall back to `low`.
- **Add new fields inside metadata namespaces.**
  - Example: add `metadata.scanner.trivy.target`.

## Breaking changes (require v2 or versioned field)

**Rule:** Any change that alters existing meaning or validation is breaking.

**Breaking examples:**
- **Rename a field** (`identifier` → `primary_identifier`).
- **Change a type** (`severity` from string → object).
- **Make an optional field required** (`location` required for SCA).
- **Change semantics** (severity scale from 5 to 3 levels).
- **Remove an enum value** (`critical` removed).

## Deprecation policy

**Steps:**
1. **Introduce replacement** in v1 (optional, documented).
2. **Mark old field as deprecated** in docs and OpenAPI descriptions.
3. **Support both for at least 1 minor release** (or 90 days) with warnings.
4. **Remove only in v2** or in a dedicated migration window.

**Example:**
- `finding.identifiers` added.
- `finding.identifier` is deprecated but still populated.
- v2 removes `finding.identifier`.

## Special cases for PUT/PATCH

### PUT (full replace)

**Rule:** PUT must preserve compatibility with older clients.

**How:**
- Treat missing optional fields as `null` or default.
- Do **not** delete unknown fields stored in `metadata`.

**Example:**
- Client PUTs only `status` and `assignee` → system keeps `metadata.scanner.*` untouched.

### PATCH (partial update)

**Rule:** PATCH must be additive and explicit.

**How:**
- Accept only allowed fields; reject changes to immutable fields (fingerprint, scanner).
- Merge `metadata` by namespace (do not overwrite entire object).

**Example:**
- PATCH `{ "metadata": { "scanner": { "trivy": { "target": "image" }}}}`
  → merge into existing `metadata.scanner`.
