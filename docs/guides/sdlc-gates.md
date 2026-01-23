# SDLC gates (CI/CD)

This guide describes how to use the gate-check API in CI/CD pipelines to enforce policy outcomes and block builds when required.

## API overview

**Endpoint:** `POST /api/v1/gates/check`

**Behavior:**
- Returns `200 OK` when the gate passes.
- Returns `412 Precondition Failed` when the gate fails (body still contains the response payload).
- `pass` is derived from the policy decision (`fail` blocks; `warn` does not).
- `blockingFindings` are derived from policy violations (when linked to findings) or, if none are linked, from findings with severity >= `high` and status != `mitigated`.

## Request

```json
{
  "importJobId": "5b3e5d52-8d4a-4e23-8ed2-2cc3c0d7d24a",
  "productId": "7b0c1c5c-86df-4dbe-9c3b-4c2b8a9077cc",
  "profile": "default",
  "commitSha": "5a9f2a4e0d8b95e4c0a2f8c6a1e2f0b3c9d1e2f3",
  "buildId": "build-12931"
}
```

Fields:
- `importJobId` (required): import job UUID to evaluate.
- `productId` (optional): product scope for policy evaluation.
- `profile` (optional): gate profile for policy routing.
- `commitSha` / `buildId` (optional): trace identifiers for audit/policy context.

## Response

```json
{
  "pass": false,
  "decision": "fail",
  "blockingFindings": [
    {
      "findingId": "c1b7a4a5-1bb1-43b9-b79f-6e2f1c7a8e1f",
      "title": "OpenSSL vulnerability",
      "severity": "critical",
      "category": "SCA",
      "violationCode": "GATE_CRITICAL_VULN"
    }
  ],
  "violations": [
    {
      "code": "GATE_CRITICAL_VULN",
      "message": "Critical vulnerabilities must be fixed before release.",
      "severity": "critical",
      "refs": [
        "finding:c1b7a4a5-1bb1-43b9-b79f-6e2f1c7a8e1f"
      ]
    }
  ],
  "policy": {
    "policyId": "f45da3a0-8f2e-4f1b-93b4-93d7b18d3b61",
    "policyRuleId": "c26f6c0d-30dd-4ef1-a522-f9f70d3b41d2",
    "version": "2024.08.12",
    "sha256": "54b22f4b1f3d75b50ea2a5d5c3e8e5e2e1df6f10d0f6c4b7a8a3a0d21f99f3d2"
  },
  "evaluatedAt": "2024-08-12T11:49:12Z"
}
```

## Interpreting the result

- **Pass**: `pass=true`, `decision` is `pass` or `warn`. CI should continue.
- **Fail**: `pass=false`, `decision=fail`. CI should fail the job.

## Shell usage (curl)

```bash
scripts/gate-check.sh "https://lotus-warden.example.com" "5b3e5d52-8d4a-4e23-8ed2-2cc3c0d7d24a"
```

Set a bearer token if needed:

```bash
export LW_API_TOKEN="your.jwt.token"
scripts/gate-check.sh "https://lotus-warden.example.com" "5b3e5d52-8d4a-4e23-8ed2-2cc3c0d7d24a"
```

## GitHub Actions example

```yaml
name: Gate Check
on:
  workflow_dispatch:

jobs:
  gate-check:
    runs-on: ubuntu-latest
    steps:
      - name: Run gate check
        env:
          LW_API_TOKEN: ${{ secrets.LOTUS_WARDEN_TOKEN }}
        run: |
          chmod +x scripts/gate-check.sh
          scripts/gate-check.sh "${{ secrets.LOTUS_WARDEN_URL }}" "${{ inputs.import_job_id }}"
```

## GitLab CI example

```yaml
stages:
  - security

gate_check:
  stage: security
  image: alpine:3.19
  variables:
    LW_API_TOKEN: "$LOTUS_WARDEN_TOKEN"
  script:
    - apk add --no-cache bash curl jq
    - chmod +x scripts/gate-check.sh
    - scripts/gate-check.sh "$LOTUS_WARDEN_URL" "$IMPORT_JOB_ID"
```
