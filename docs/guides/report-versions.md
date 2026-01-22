# Report versions

This guide defines how report versions are detected and how multiple parser versions can coexist safely.

## Determining `schemaVersion`

**Preferred sources (in order):**
1. Explicit `schemaVersion` field in report.
2. Tool version + known schema mapping table.
3. Filename hints (fallback only).

**Examples:**
- Trivy JSON: root `SchemaVersion` → map to internal `schemaVersion`.
- Semgrep JSON: root `version` → map to internal `schemaVersion`.

**Rule:** If version cannot be determined, store as `schemaVersion=unknown` and keep raw evidence for manual processing.

## Supporting multiple parser versions

**Strategy:**
- Keep parser modules namespaced by scanner + version.
- Maintain a tiny adapter to convert older parsed outputs into the latest normalized shape.

**Example layout:**
- `parsers/trivy/v0_49/parse.go`
- `parsers/trivy/v0_50/parse.go`
- `parsers/trivy/normalize.go` (shared)

**Flow:**
1. Detect `schemaVersion`.
2. Route to versioned parser.
3. Adapt to current normalized shape.
4. Map to canonical DTO v1.

## Unknown fields handling

**Rule:** Never drop unknown fields; store them in a namespaced container.

**Where:**
- `metadata.raw_data` for unparsed report fragments.
- `metadata.scanner.<tool>` for tool-specific fields.

**Examples:**
- Trivy: `metadata.scanner.trivy.pkgPath`.
- Semgrep: `metadata.scanner.semgrep.dataflow_trace`.

**Why:** This protects forward compatibility and enables reprocessing without re-upload.
