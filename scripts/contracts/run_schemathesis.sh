#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
API_URL="${API_URL%/}"

OPENAPI_SPEC="${OPENAPI_SPEC:-backend/openapi.json}"

# python heredoc читает env, поэтому экспортируем
export ROOT_EMAIL="${ROOT_EMAIL:-root@localhost}"
export ROOT_PASSWORD="${ROOT_PASSWORD:-root}"
export CONTRACTS_PASSWORD="${CONTRACTS_PASSWORD:-root-contract-1234}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required" >&2; exit 1; }; }
need curl
need python
need schemathesis

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

LAST_CODE=""
LAST_HDR=""
LAST_BODY=""
LAST_URL=""
LAST_METHOD=""

debug_last() {
  echo "---- HTTP DEBUG ----" >&2
  echo "${LAST_METHOD} ${LAST_URL}" >&2
  echo "HTTP: ${LAST_CODE}" >&2
  echo "---- headers ----" >&2
  [[ -f "$LAST_HDR" ]] && cat "$LAST_HDR" >&2 || true
  echo "---- body (first 1200 bytes) ----" >&2
  [[ -f "$LAST_BODY" ]] && head -c 1200 "$LAST_BODY" >&2 || true
  echo "--------------------" >&2
}

http() {
  # Usage: http METHOD URL [curl args...]
  local method="$1"; shift
  local url="$1"; shift

  LAST_METHOD="$method"
  LAST_URL="$url"
  LAST_HDR="$tmpdir/hdr_$(date +%s%N)"
  LAST_BODY="$tmpdir/body_$(date +%s%N)"
  LAST_CODE=""

  local code rc
  set +e
  code="$(curl -sS \
    --connect-timeout 5 \
    --max-time 30 \
    --location --max-redirs 5 \
    --post301 --post302 --post303 \
    --fail-with-body \
    -X "$method" "$url" \
    -D "$LAST_HDR" \
    -o "$LAST_BODY" \
    -w '%{http_code}' \
    "$@")"
  rc=$?
  set -e

  LAST_CODE="$code"

  if [[ $rc -ne 0 ]]; then
    echo "ERROR: curl failed (exit=$rc)" >&2
    debug_last
    return 1
  fi

  if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
    echo "ERROR: HTTP status is not 2xx" >&2
    debug_last
    return 1
  fi

  cat "$LAST_BODY"
}

token_from_file() {
  local path="$1"
  python - <<PY
import json,sys
p = "${path}"
raw = open(p, "rb").read().decode("utf-8", "replace")
if not raw.strip():
  print("ERROR: empty response body (expected JSON)", file=sys.stderr)
  sys.exit(1)
try:
  obj = json.loads(raw)
except Exception as e:
  print("ERROR: response is not valid JSON:", e, file=sys.stderr)
  print("---- response (first 1200 bytes) ----", file=sys.stderr)
  print(raw[:1200], file=sys.stderr)
  sys.exit(1)
try:
  print(obj["data"]["token"])
except Exception as e:
  print("ERROR: JSON does not contain data.token:", e, file=sys.stderr)
  print("---- parsed JSON (first 1200 bytes) ----", file=sys.stderr)
  print(json.dumps(obj, ensure_ascii=False)[:1200], file=sys.stderr)
  sys.exit(1)
PY
}

echo "Checking API health: ${API_URL}/health"
http GET "${API_URL}/health" >/dev/null

if [[ ! -s "$OPENAPI_SPEC" ]]; then
  echo "ERROR: OpenAPI spec file not found or empty: $OPENAPI_SPEC" >&2
  exit 1
fi

make_login_payload() {
  local pass="$1"
  python - <<PY
import json,os
print(json.dumps({"login": os.environ["ROOT_EMAIL"], "password": "${pass}"}))
PY
}

# ---- LOGIN (retry) ----
echo "Login with ROOT_PASSWORD..."

login_resp="$tmpdir/login.json"
login_token=""

for i in {1..30}; do
  rm -f "$login_resp"
  if http POST "${API_URL}/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      -d "$(make_login_payload "$ROOT_PASSWORD")" > "$login_resp"; then

    if [[ ! -s "$login_resp" ]]; then
      echo "Login attempt $i: empty body" >&2
      debug_last
      sleep 2
      continue
    fi

    if login_token="$(token_from_file "$login_resp")"; then
      break
    fi

    echo "Login attempt $i: JSON but no data.token" >&2
    debug_last
    sleep 2
    continue
  else
    echo "Login attempt $i: HTTP failed" >&2
    # debug_last already printed in http()
    sleep 2
    continue
  fi
done

if [[ -z "$login_token" ]]; then
  echo "ERROR: login did not succeed after retries" >&2
  exit 1
fi

# ---- CHANGE PASSWORD (optional) ----
change_payload="$tmpdir/change_payload.json"
cat > "$change_payload" <<EOF
{"currentPassword":"${ROOT_PASSWORD}","newPassword":"${CONTRACTS_PASSWORD}","newPasswordConfirm":"${CONTRACTS_PASSWORD}"}
EOF

change_resp="$tmpdir/change.json"
api_token=""

echo "Change password (may fail if already changed)..."
set +e
rm -f "$change_resp"
http POST "${API_URL}/api/v1/auth/change-password" \
  -H "Authorization: Bearer ${login_token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d @"$change_payload" > "$change_resp"
change_rc=$?
set -e

if [[ $change_rc -eq 0 && -s "$change_resp" ]]; then
  api_token="$(token_from_file "$change_resp")"
else
  echo "Change-password failed or empty; fallback to login with CONTRACTS_PASSWORD" >&2
  rm -f "$login_resp"
  http POST "${API_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$(make_login_payload "$CONTRACTS_PASSWORD")" > "$login_resp"

  api_token="$(token_from_file "$login_resp")"
fi

# ---- SCHEMATHESIS ----
schemathesis run "$OPENAPI_SPEC" \
  --base-url "$API_URL" \
  --header "Authorization: Bearer ${api_token}" \
  --method GET \
  --endpoint /api/v1/findings \
  --endpoint /api/v1/products \
  --endpoint /api/v1/import-jobs \
  --checks not_a_server_error \
  --validate-schema
