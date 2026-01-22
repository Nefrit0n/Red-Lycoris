# Contract tests

This directory contains OpenAPI v1 contract fixtures and scripts that validate backend API responses against the OpenAPI schema.

## Prerequisites

- Docker (for dependencies) or a locally running Postgres, NATS, and MinIO stack.
- Go, Python 3, and Node (for the repo checks).

## Start dependencies (local)

```bash
docker compose up -d postgres nats minio
```

## Run backend locally

```bash
cd backend
export DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=lotus_warden DB_SSLMODE=disable
export NATS_URL=nats://localhost:4222
export OBJECT_STORE_ENDPOINT=localhost:9000 OBJECT_STORE_ACCESS_KEY=minioadmin OBJECT_STORE_SECRET_KEY=minioadmin OBJECT_STORE_BUCKET=lotus-warden OBJECT_STORE_USE_SSL=false
export ROOT_EMAIL=root@localhost ROOT_PASSWORD=root JWT_SECRET=local-contract-secret

go run ./cmd/migrate
GO_ENV=local go run ./cmd/server
```

## Contract checks

### Snapshot fixtures validation

```bash
python -m pip install jsonschema
python scripts/contracts/validate_fixtures.py
```

### Schema validation (Schemathesis)

```bash
python -m pip install schemathesis
CONTRACTS_PASSWORD=root-contract-1234 \
  scripts/contracts/run_schemathesis.sh
```

### Backward compatibility gate (OpenAPI diff)

```bash
go install github.com/tufin/oasdiff/cmd/oasdiff@latest
scripts/contracts/check_openapi_compat.sh
```

## CI-style command overview

- Backend lint/build/test: `go vet ./... && go test ./...`
- Frontend lint/test: `npm run lint && npm run test`
- Contract checks: `python scripts/contracts/validate_fixtures.py`, `scripts/contracts/run_schemathesis.sh`, `scripts/contracts/check_openapi_compat.sh`
