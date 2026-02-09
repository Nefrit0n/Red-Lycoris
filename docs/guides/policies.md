# Policy-as-Code (Phase 1)

## Canonical format: Rego (OPA)

Rego (OPA) is the canonical, executable source of truth for policies in Red Lycoris. The choice is driven by:

- **Purpose-built for policy-as-code**: Rego is declarative and optimized for expressing allow/deny decisions and exceptions.
- **Deterministic evaluation**: policies are pure functions over input, which makes decisions reproducible and auditable.
- **CI/CD guardrails**: Rego is widely adopted for gating pipelines, infrastructure changes, and security controls, so it is well-suited for “break build” policies and pre-deploy checks.
- **Ecosystem & tooling**: OPA provides `opa check`, `opa eval`, and bundle workflows for local validation and CI integration.

## Supported formats

- **rego** — MVP and canonical executable format.
- **yaml/json** — reserved for future use (non-executable configuration wrappers or compiled policy artifacts).

## Versioning (SemVer)

Policies and policy rules are versioned using SemVer (`MAJOR.MINOR.PATCH`).

- **MAJOR** — breaking change in policy logic or output contract.
- **MINOR** — backward-compatible change (new checks, new optional output fields, extra metadata).
- **PATCH** — bugfixes or clarifications that do not change outcomes for existing inputs.

Recommended rules:
- Bump **MAJOR** when a policy could produce different decisions for existing inputs without explicit opt-in.
- Bump **MINOR** when adding new rules that do not reduce existing allowances.
- Bump **PATCH** for refactors, documentation, and non-functional changes.

## Safe input context (allowlist)

Policies **must** use a safe, explicitly allowed input schema. This is to prevent leakage of raw evidence, secrets, or full scan payloads into policy evaluation.

### `finding`
Allowed fields (example):
- `id` (string)
- `title` (string)
- `severity` (string)
- `status` (string)
- `category` (string)
- `scanner` (string, optional)
- `source_type` (string, optional)
- `first_seen_at` (RFC3339 string, optional)
- `last_seen_at` (RFC3339 string, optional)
- `product_id` (string, optional)
- `import_job_id` (string, optional)
- `fixed_version` (string, optional, for SCA/SBOM findings)

Forbidden fields:
- `raw_data`, `raw_report`, `evidence`, `payload`, or any scanner-specific full JSON.
- Any secrets, credentials, or full files.

### `product`
Allowed fields:
- `id` (string)
- `name` (string)
- `slug` (string)
- `identifier` (string, optional)
- `version` (string, optional)
- `asset_criticality` (string, optional)

Forbidden fields:
- Any secrets, credentials, or internal system metadata.

### `import_job`
Allowed fields:
- `id` (string)
- `scanner` (string)
- `status` (string)
- `findings_total` (number)
- `findings_new` (number)
- `duplicates_total` (number)
- `created_at` (RFC3339 string)
- `started_at` (RFC3339 string, optional)
- `finished_at` (RFC3339 string, optional)

Forbidden fields:
- `raw_report`, full scanner payloads, or any secret material.

## Output contract (v1)

Policies must return a **decision** and a **violations** array.

```json
{
  "decision": "pass|fail|warn",
  "violations": [
    {
      "code": "string",
      "message": "string",
      "severity": "low|medium|high|critical",
      "action": "string",
      "refs": ["string"]
    }
  ]
}
```

Notes:
- `decision` is required.
- `violations` MAY be empty.
- `severity` is informational and does not override `decision`.
- `action` is a recommendation for downstream automation (not executed in Phase 1).
