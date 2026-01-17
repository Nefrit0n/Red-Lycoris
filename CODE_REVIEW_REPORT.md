# Lotus Warden Code Review Report

## Project map

- `backend/`: Go Fiber API server, migrations, handlers, storage, models.
- `frontend/`: React + TypeScript (MUI) Vite UI.
- `python_api/`: FastAPI + Celery background tasks.
- `nginx/`: reverse proxy for UI and APIs.
- `shared/`: shared assets/config.
- `scripts/`: helper scripts.

## Baseline (commands + results)

- `go test ./...` (from `backend/`): **hung/no output**; interrupted with Ctrl+C.
- `npm run lint` (from `frontend/`): **failed** with unused variable in `PaginationControl` and missing dependency warning in `FindingsList`.

## Issues found & actions

### High
- **Idempotency gap for scan uploads**: repeated uploads of the same report could create duplicate import jobs when a prior job was still running/queued. **Fixed** by returning the existing job for any non-failed status (queued/running/succeeded). Added tests.
- **RBAC gaps on write endpoints**: findings update and comment endpoints were not protected by role-based authorization. **Fixed** by requiring `analyst` or `admin` role. Added test covering enforcement.

### Medium
- **Unbounded scan report payload**: scan uploads accepted arbitrarily large JSON, risking memory pressure. **Fixed** by adding a 10MB cap for JSON or multipart report payloads. Added test for oversized report rejection.
- **Missing correlation IDs in logs**: no request ID or log correlation. **Fixed** by adding request ID middleware and including `request_id` in logs.

### Low
- **Frontend lint issues**: unused variable in pagination label and missing dependency in `useEffect`. **Fixed** by using the `from` parameter in label and adding `location.search` to dependencies.

## Changes made

- Backend scan upload idempotency and size limits, with tests.
- Request ID logging in API server.
- RBAC enforcement for findings updates/comments with test.
- Frontend pagination label and effect dependencies.

## Remaining TODOs

- `go test ./...` needs investigation; backend tests may stall on module download or external dependencies.
- Expand security validation on other upload endpoints (e.g., file type detection and content-type enforcement).
- Add integration tests for RBAC on other write endpoints (bulk actions, delete, import).

## Security posture summary

- Strengthened RBAC on write actions.
- Enforced idempotency for repeated scan uploads.
- Added payload size limits for scan report uploads.
- Added request correlation IDs for auditability.
