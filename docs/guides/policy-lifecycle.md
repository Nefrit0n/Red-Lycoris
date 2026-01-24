# Policy lifecycle: change → re-evaluate → gate

## Overview

Policies are versioned Rego rules applied to findings, imports, and scan results. Each evaluation writes a `policy_results` record, which is used for auditing and gate decisions. Policy changes are always logged in `audit_log` with actor metadata and a before/after diff.

## Change flow

1. **Admin updates policy metadata / version / assignments**
   - UI hits `/api/v1/admin/policies` endpoints.
   - Each change writes a dedicated `audit_log` entry with `policy.*` action, actor info, and request metadata.
   - Policy content is **not** stored in audit logs; only the rule SHA256 and a short preview are recorded.

2. **Lazy re-evaluation (MVP)**
   - The system performs **lazy re-evaluation**: a policy is re-evaluated when the subject is evaluated again (import processing, gate check, or on-demand status changes).
   - This means new policy versions take effect immediately on **new** evaluations, while existing `policy_results` remain as historical records until re-triggered.
   - For compliance, use the export endpoint (below) to track which policy version produced which decision.

3. **Gate check decision**
   - Gate checks always run a fresh evaluation using the current policy assignments and latest policy versions.
   - The decision payload contains policy metadata, and the evaluation writes a new `policy_results` row.

## Export & audit

### Policy results export

Use this for compliance snapshots and external reporting:

```
GET /api/v1/policy-results/export?format=csv|json&productId=&importJobId=&policyId=&decision=&from=&to=&limit=
```

- `format=csv` returns a streaming CSV with a header row.
- `format=json` returns **NDJSON** (newline-delimited JSON), one result per line.
- `limit` is capped (default 5000, max 20000) to avoid excessive load.
- Access is restricted to **admin/superuser** users.

Exported fields (MVP):
- `evaluatedAt`
- `policyId`
- `policyVersion`
- `subjectType`
- `subjectId`
- `decision`
- `violationCodes`
- `blockingFindingIds` (empty in MVP)

### Audit log payloads

For all policy changes, `audit_log.payload` contains:
- `diff.before` and `diff.after` snapshots
- `meta` with `ip`, `user_agent`, and optional `request_id`

## Optional: OPA decision logs

If you enable OPA decision logging, each evaluation can include a `decision_id`. That ID can be stored in `policy_results` to correlate with an external decision-log sink (e.g., SIEM or audit store). This is not enabled in MVP, but the system can be extended to persist and export `decision_id` for full forensic traceability.

## SLA breach background updates

SLA breach status (`sla_breached` / `sla_breached_at`) is updated by a background job running in the API server. Configure the cadence with `SLA_BREACH_INTERVAL` (default `15m`). Each run records metrics for how many findings were updated so operations can monitor the SLA refresh activity.
