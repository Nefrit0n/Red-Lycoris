#!/bin/sh
set -eu

# === where is lw.sh ===
LW_SH="${LW_SH:-./lw.sh}"

# === filled test defaults (override by exporting env vars before running) ===
ENDPOINT="${ENDPOINT:-https://localhost}"   # поменяй на свой API
PROJECT="${PROJECT:-demo-project}"               # project id/slug как у тебя в платформе
TOKEN="${TOKEN:-rlx_test_REPLACE_ME}"            # ВАЖНО: замени на реальный токен

# lw.sh release channel (if you use bootstrap downloads)
LW_BASE_URL="${LW_BASE_URL:-http://localhost:8000/releases/lw}"
LW_VERSION="${LW_VERSION:-0.1.0}"

# scanning results file
RESULT_FILE="${RESULT_FILE:-result_trivy.json}"

# optional tuning
STATE_FILE="${STATE_FILE:-.lw-upload-state.json}"
MAX_CONCURRENCY="${MAX_CONCURRENCY:-2}"
LOG_FORMAT="${LOG_FORMAT:-json}"

# === GitLab CI metadata (TEST). If already set by GitLab CI -> keep real values ===
: "${CI_PIPELINE_ID:=123456}"
: "${CI_PIPELINE_IID:=123}"
: "${CI_PIPELINE_URL:=https://gitlab.example/group/proj/-/pipelines/123456}"
: "${CI_PIPELINE_SOURCE:=push}"

: "${CI_JOB_ID:=654321}"
: "${CI_JOB_URL:=https://gitlab.example/group/proj/-/jobs/654321}"
: "${CI_JOB_NAME:=upload_results}"
: "${CI_JOB_STAGE:=upload}"
: "${CI_JOB_STARTED_AT:=2026-02-18T12:00:00Z}"

: "${CI_PROJECT_ID:=999}"
: "${CI_PROJECT_PATH:=group/proj}"
: "${CI_PROJECT_URL:=https://gitlab.example/group/proj}"
: "${CI_SERVER_URL:=https://gitlab.example}"
: "${CI_API_V4_URL:=https://gitlab.example/api/v4}"

: "${CI_COMMIT_SHA:=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef}"
: "${CI_COMMIT_REF_NAME:=main}"
: "${CI_COMMIT_BRANCH:=main}"
: "${CI_COMMIT_TAG:=}"
: "${CI_COMMIT_TIMESTAMP:=2026-02-18T12:00:00Z}"

# === checks ===
if [ ! -f "$RESULT_FILE" ]; then
  echo "ERROR: result file not found: $RESULT_FILE" >&2
  echo "Put your prepared Trivy report at ./$RESULT_FILE or set RESULT_FILE=/path/to/file" >&2
  exit 2
fi

if [ ! -x "$LW_SH" ]; then
  echo "ERROR: lw.sh not found or not executable: $LW_SH" >&2
  echo "Set LW_SH=/path/to/lw.sh or run: chmod +x ./lw.sh" >&2
  exit 2
fi

# === run ===
export LW_BASE_URL LW_VERSION

# NOTE:
#  - --insecure requires your lw binary to support it (you asked to add it).
#  - If your endpoint is plain HTTP, remove --insecure and use http://...
exec sh "$LW_SH" upload \
  --endpoint "$ENDPOINT" \
  --project "$PROJECT" \
  --token "$TOKEN" \
  --artifact "${RESULT_FILE}:format=trivy-json,tool_name=trivy,tool_version=0.56.0" \
  --ci gitlab \
  --enrich env,git \
  --idempotency-key "test-$(date +%s)" \
  --state-file "$STATE_FILE" \
  --max-concurrency "$MAX_CONCURRENCY" \
  --log "$LOG_FORMAT" \
  --insecure
