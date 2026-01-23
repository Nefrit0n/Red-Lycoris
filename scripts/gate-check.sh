#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <base_url> <import_job_id>" >&2
  echo "Environment: LW_API_TOKEN (optional bearer token)" >&2
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

BASE_URL="$1"
IMPORT_JOB_ID="$2"
TOKEN="${LW_API_TOKEN:-}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

version_ge() {
  local current="$1"
  local minimum="$2"
  [[ "$(printf '%s\n' "$minimum" "$current" | sort -V | head -n1)" == "$minimum" ]]
}

curl_version="$(curl --version | head -n1 | awk '{print $2}')"
use_fail_with_body=false
if version_ge "$curl_version" "7.76.0"; then
  use_fail_with_body=true
fi

auth_header=()
if [[ -n "$TOKEN" ]]; then
  auth_header=(-H "Authorization: Bearer ${TOKEN}")
fi

payload="$(jq -n --arg importJobId "$IMPORT_JOB_ID" '{importJobId: $importJobId}')"
response_file="$(mktemp)"
http_code=""
curl_exit=0

if [[ "$use_fail_with_body" == "true" ]]; then
  http_code=$(curl --fail-with-body -sS -o "$response_file" -w "%{http_code}" \
    -H "Content-Type: application/json" "${auth_header[@]}" \
    --data "$payload" \
    "${BASE_URL%/}/api/v1/gates/check") || curl_exit=$?
else
  if ! curl -f -sS -o "$response_file" \
    -H "Content-Type: application/json" "${auth_header[@]}" \
    --data "$payload" \
    "${BASE_URL%/}/api/v1/gates/check"; then
    curl_exit=$?
    http_code=$(curl -sS -o "$response_file" -w "%{http_code}" \
      -H "Content-Type: application/json" "${auth_header[@]}" \
      --data "$payload" \
      "${BASE_URL%/}/api/v1/gates/check" || true)
  else
    http_code="200"
  fi
fi

cat "$response_file"

if [[ -n "$http_code" && "$http_code" != "200" && "$http_code" != "412" ]]; then
  echo "Gate check request failed with HTTP status ${http_code}." >&2
  exit 1
fi

if [[ "$curl_exit" -ne 0 && "$http_code" != "412" ]]; then
  echo "Gate check request failed." >&2
  exit 1
fi

pass="$(jq -r '.pass' "$response_file" 2>/dev/null || echo "false")"
if [[ "$pass" != "true" ]]; then
  exit 1
fi
exit 0
