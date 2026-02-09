#!/usr/bin/env bash
set -euo pipefail

API_URL=${API_URL:-"http://localhost:8080"}
TOKEN=${TOKEN:-""}
PRODUCT_NAME=${PRODUCT_NAME:-"Snapshot QA Product"}
ARCHIVE_PATH=${ARCHIVE_PATH:-"/tmp/source.zip"}

MINIO_ENDPOINT=${MINIO_ENDPOINT:-"http://localhost:9000"}
MINIO_BUCKET=${MINIO_BUCKET:-"red-lycoris"}
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-""}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-""}

if [[ -z "$TOKEN" ]]; then
  echo "TOKEN is required" >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "ARCHIVE_PATH does not exist: $ARCHIVE_PATH" >&2
  exit 1
fi

AUTH_HEADER=("-H" "Authorization: Bearer ${TOKEN}")

create_product() {
  python3 - <<'PY'
import json,sys
print(json.dumps({"name": sys.argv[1]}))
PY
}

product_payload=$(create_product "$PRODUCT_NAME")
product_resp=$(curl -sS "${API_URL}/api/v1/products" -H "Content-Type: application/json" "${AUTH_HEADER[@]}" -d "$product_payload")
product_id=$(python3 - <<'PY'
import json,sys
payload=json.loads(sys.argv[1])
print(payload["data"]["id"])
PY "$product_resp")

echo "Created product: $product_id"

snapshot_resp=$(curl -sS "${API_URL}/api/v1/products/${product_id}/source-snapshots" "${AUTH_HEADER[@]}" -H "Idempotency-Key: $(python3 - <<'PY'
import uuid;print(uuid.uuid4())
PY)" -F "archive=@${ARCHIVE_PATH}")

snapshot_id=$(python3 - <<'PY'
import json,sys
payload=json.loads(sys.argv[1])
print(payload["data"]["id"])
PY "$snapshot_resp")

echo "Created snapshot: $snapshot_id"

job_snapshot_resp=$(curl -sS "${API_URL}/api/v1/analysis-jobs" "${AUTH_HEADER[@]}" -H "Idempotency-Key: $(python3 - <<'PY'
import uuid;print(uuid.uuid4())
PY)" -F "product_id=${product_id}" -F "source_snapshot_id=${snapshot_id}" -F "scanners=semgrep,trivy")
job_snapshot_id=$(python3 - <<'PY'
import json,sys
payload=json.loads(sys.argv[1])
print(payload["data"]["id"])
PY "$job_snapshot_resp")

job_ephemeral_resp=$(curl -sS "${API_URL}/api/v1/analysis-jobs" "${AUTH_HEADER[@]}" -H "Idempotency-Key: $(python3 - <<'PY'
import uuid;print(uuid.uuid4())
PY)" -F "product_id=${product_id}" -F "archive=@${ARCHIVE_PATH}" -F "scanners=semgrep,trivy")
job_ephemeral_id=$(python3 - <<'PY'
import json,sys
payload=json.loads(sys.argv[1])
print(payload["data"]["id"])
PY "$job_ephemeral_resp")

poll_job() {
  local job_id=$1
  for _ in $(seq 1 60); do
    job_resp=$(curl -sS "${API_URL}/api/v1/analysis-jobs/${job_id}" "${AUTH_HEADER[@]}")
    status=$(python3 - <<'PY'
import json,sys
payload=json.loads(sys.argv[1])
print(payload["data"]["status"])
PY "$job_resp")
    echo "Job ${job_id} status: ${status}"
    if [[ "$status" == "succeeded" || "$status" == "failed" ]]; then
      return 0
    fi
    sleep 5
  done
  echo "Job ${job_id} did not finish in time" >&2
  return 1
}

echo "Polling snapshot-backed job..."
poll_job "$job_snapshot_id"

echo "Polling ephemeral job..."
poll_job "$job_ephemeral_id"

if command -v aws >/dev/null 2>&1 && [[ -n "$MINIO_ACCESS_KEY" && -n "$MINIO_SECRET_KEY" ]]; then
  export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"
  echo "Checking snapshot object exists..."
  aws --endpoint-url "$MINIO_ENDPOINT" s3api head-object --bucket "$MINIO_BUCKET" --key "products/${product_id}/source-snapshots/${snapshot_id}/archive.zip" >/dev/null
  echo "Snapshot object found."
else
  echo "Skipping object store verification (aws cli or credentials missing)."
fi

cat <<'NOTE'
Verification notes:
- If snapshot object check fails, confirm object_key in DB and adjust key in this script.
- Ephemeral archive cleanup is handled asynchronously by worker cleanup after completion.
NOTE
