#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
OPENAPI_SPEC="${OPENAPI_SPEC:-backend/openapi.json}"

# ВАЖНО: python читает из os.environ, поэтому экспортируем
export ROOT_EMAIL="${ROOT_EMAIL:-root@localhost}"
export ROOT_PASSWORD="${ROOT_PASSWORD:-root}"
export CONTRACTS_PASSWORD="${CONTRACTS_PASSWORD:-root-contract-1234}"

if ! command -v schemathesis >/dev/null 2>&1; then
  echo "schemathesis is required (pip install schemathesis)" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

# ---- helpers ----

curl_json() {
  # Usage: curl_json METHOD URL [headers...]
  # Prints response body to stdout. Fails on HTTP >= 400 AND prints body.
  local method="$1"; shift
  local url="$1"; shift

  # --fail-with-body: падаем на 4xx/5xx, но не теряем body (удобно для дебага)
  curl -sS --fail-with-body -X "$method" "$url" "$@"
}

json_get_token() {
  # Reads JSON from stdin and prints .data.token or fails with diagnostics
  python - <<'PY'
import json,sys
raw = sys.stdin.read()
if not raw.strip():
  print("ERROR: empty response body (expected JSON)", file=sys.stderr)
  sys.exit(1)
try:
  obj = json.loads(raw)
except Exception as e:
  print("ERROR: response is not valid JSON:", e, file=sys.stderr)
  print("---- response (first 800 bytes) ----", file=sys.stderr)
  print(raw[:800], file=sys.stderr)
  sys.exit(1)

try:
  print(obj["data"]["token"])
except Exception as e:
  print("ERROR: JSON does not contain data.token:", e, file=sys.stderr)
  print("---- parsed JSON (first 800 bytes) ----", file=sys.stderr)
  s = json.dumps(obj, ensure_ascii=False)
  print(s[:800], file=sys.stderr)
  sys.exit(1)
PY
}

# ---- sanity checks ----

echo "Checking API health: $API_URL/health"
curl -sSf "$API_URL/health" >/dev/null

if [[ ! -s "$OPENAPI_SPEC" ]]; then
  echo "OpenAPI spec file not found or empty: $OPENAPI_SPEC" >&2
  echo "Tip: set OPENAPI_SPEC to a URL if your API serves it (e.g. $API_URL/openapi.json)" >&2
  exit 1
fi

# ---- auth flow (idempotent) ----

login() {
  local password="$1"
  local payload
  payload="$(python - <<PY
import json,os
print(json.dumps({"login": os.environ["ROOT_EMAIL"], "password": "${password}"}))
PY
)"
  curl_json POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

echo "Login with ROOT_PASSWORD..."
set +e
login_response="$(login "$ROOT_PASSWORD")"
login_rc=$?
set -e

if [[ $login_rc -ne 0 ]]; then
  echo "Login with ROOT_PASSWORD failed, trying CONTRACTS_PASSWORD (idempotent run)..." >&2
  login_response="$(login "$CONTRACTS_PASSWORD")"
fi

login_token="$(printf "%s" "$login_response" | json_get_token)"

# пытаемся сменить пароль; если уже сменён — будет ошибка, тогда просто используем CONTRACTS_PASSWORD
change_payload="$(python - <<'PY'
import json,os
print(json.dumps({
  "currentPassword": os.environ["ROOT_PASSWORD"],
  "newPassword": os.environ["CONTRACTS_PASSWORD"],
  "newPasswordConfirm": os.environ["CONTRACTS_PASSWORD"],
}))
PY
)"

echo "Change password (may fail if already changed)..."
set +e
change_response="$(curl_json POST "$API_URL/api/v1/auth/change-password" \
  -H "Authorization: Bearer ${login_token}" \
  -H "Content-Type: application/json" \
  -d "$change_payload")"
change_rc=$?
set -e

if [[ $change_rc -eq 0 ]]; then
  api_token="$(printf "%s" "$change_response" | json_get_token)"
else
  echo "Change-password failed; proceeding with CONTRACTS_PASSWORD login token..." >&2
  # логинимся новым паролем и берём токен
  api_token="$(printf "%s" "$(login "$CONTRACTS_PASSWORD")" | json_get_token)"
fi

# ---- schemathesis ----
schemathesis run "$OPENAPI_SPEC" \
  --base-url "$API_URL" \
  --header "Authorization: Bearer ${api_token}" \
  --method GET \
  --endpoint /api/v1/findings \
  --endpoint /api/v1/products \
  --endpoint /api/v1/import-jobs \
  --checks not_a_server_error \
  --validate-schema
