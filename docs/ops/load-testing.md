# Load testing for release 0.1.0b

## Prerequisites

- Host with at least 4 vCPU, 8 GB RAM, SSD storage (recommended for stable latency).
- Docker Engine + Docker Compose plugin.
- Built backend/frontend images (for example `redlycoris/backend:0.1.0b` and `redlycoris/frontend:0.1.0b`).
- PAT token with scopes:
  - `findings:read`
  - `findings:write`
- Existing project UUID (created via UI after stack startup).

> `loadtest` requires explicit `--url` to avoid accidental runs against a local dev instance.

## Reproducible sequence

1. Start isolated loadtest stack:

   ```bash
   docker compose -f deployments/docker-compose.loadtest.yml up -d
   ```

2. Create a project in UI and save project UUID.
3. Create a PAT token with `findings:read` + `findings:write`.
4. Generate fixture:

   ```bash
   cd backend
   go run ./cmd/loadtest generate --output=../testdata/fixtures --size=100000
   ```

5. Seed findings:

   ```bash
   go run ./cmd/loadtest seed \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --project=<project_uuid> \
     --file=../testdata/fixtures/sarif_100000.json
   ```

6. Run browse scenario:

   ```bash
   go run ./cmd/loadtest browse \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --project=<project_uuid> \
     --duration=5m \
     --concurrency=10 \
     --report=report_browse.json
   ```

7. Run dashboard scenario:

   ```bash
   go run ./cmd/loadtest dashboard \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --duration=2m \
     --concurrency=5 \
     --report=report_dashboard.json
   ```

8. Optional export scenario:

   ```bash
   go run ./cmd/loadtest export \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --format=csv \
     --report=report_export.json
   ```

## Scenarios summary

- `generate`: creates SARIF with N findings using curated real CVEs.
- `seed`: uploads SARIF via `/api/v1/import?project_id=<uuid>`.
- `browse`: random filters + cursor pagination + finding detail fetch.
- `dashboard`: loops on `/api/v1/dashboard/stats`.
- `export`: export endpoint test with TTFB + total duration.

## JSON report format

Each scenario writes report like:

```json
{
  "scenario": "browse",
  "started_at": "2026-04-22T12:00:00Z",
  "finished_at": "2026-04-22T12:05:00Z",
  "duration_seconds": 300,
  "concurrency": 10,
  "endpoints": [
    {
      "name": "GET /api/v1/findings",
      "count": 12345,
      "success_count": 12340,
      "error_count": 5,
      "p50_ms": 42,
      "p90_ms": 120,
      "p95_ms": 180,
      "p99_ms": 450,
      "rps": 41.15
    }
  ],
  "target_version": "0.1.0b",
  "target_commit": "abc1234"
}
```

## Metrics interpretation

- `count`: total calls for endpoint.
- `success_count`: HTTP 2xx responses.
- `error_count`: non-2xx + transport/network failures.
- `p50/p90/p95/p99`: end-to-end latency percentiles in milliseconds.
- `rps`: endpoint throughput (`count / scenario_duration_seconds`).
- `ttfb_*` (export): latency to first byte.

Use `jq` to validate report structure:

```bash
jq . report_browse.json
```

## Release notes table template

| Build | Commit | Scenario | Concurrency | Duration | Findings volume | p50 | p95 | p99 | RPS | Error rate |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.1.0b | `<sha>` | browse | 10 | 5m | 100k |  |  |  |  |  |
| 0.1.0b | `<sha>` | dashboard | 5 | 2m | 100k |  |  |  |  |  |
| 0.1.0b | `<sha>` | export(csv) | 1 | single run | 100k |  |  |  |  |  |
