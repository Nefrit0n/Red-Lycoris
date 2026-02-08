#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
API_URL="${API_URL%/}" # убрать trailing slash, чтобы не получить // в URL

OPENAPI_SPEC="${OPENAPI_SPEC:-backend/openapi.json}"

# Важно: python в heredoc читает из os.environ, поэтому экспортируем
export ROOT_EMAIL="${ROOT_EMAIL:-root@localhost}"
export ROOT_PASSWORD="${ROOT_PASSWORD:-root}"
export CONTRACTS_PASSWORD="${CONTRACTS_PASSWORD:-root-contract-1234}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: '$1' is required" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd python
require_cmd schemathesis

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# globals for debugging last request
LAST_HTTP_CODE=""
LAST_HTTP_HDR=""
LAST_HTTP_BODY=""
LAST_HTTP_URL=""
LAST_HTTP_METHOD=""

debug_last_http() {
  echo "---- HTTP DEBUG ----" >&2
  echo "${LAST_HTTP_METHOD} ${LAST_HTTP_URL}" >&2
  echo "HTTP: ${LAST_HTTP_CODE}" >&2
  echo "---- headers ----" >&2
  if [[ -n "${LAST_HTTP_HDR}" && -f "${LAST_HTTP_HDR}" ]]; then
    cat "${LAST_HTTP_HDR}" >&2 || true
  fi
  echo "---- body (first 1200 bytes) ----" >&2
  if [[ -n "${LAST_HTTP_BODY}" && -f "${LAST_HTTP_BODY}" ]]; then
    head -c 1200 "${LAST_HTTP_BODY}" >&2 || true
  fi
  echo "--------------------" >&2
}

http() {
  # Usage: http METHOD URL [curl args...]
  local method="$1"; shift
  local url="$1"; shift

  local hdr_file body_file
  hdr_file="${TMPDIR}/hdr_$(date +%s%N)"
  body_file="${TMPDIR}/body_$(date +%s%N)"

  LAST_HTTP_METHOD="$method"
  LAST_HTTP_URL="$url"
  LAST_HTTP_HDR="$hdr_file"
  LAST_HTTP_BODY="$body_file"
  LAST_HTTP_CODE=""

  # ВАЖНО:
  # - --location: следовать редиректам
  # - --post301/302/303: сохранять POST при редиректах 301/302/303
  # - --fail-with-body: при 4xx/5xx вернёт non-zero, но body не потеряется
  # См. документацию curl / everything curl :contentReference[oaicite:3]{index=3}
  local code rc
  set +e
  code="$(curl -sS \
    --connect-timeout 5 \
    --max-time 30 \
    --location --max-redirs 5 \
    --post301 --post302 --post303 \
    --fail-with-body \
    -X "$method" "$url" \
    -D "$hdr_file" \
    -o "$body_file" \
    -w '%{http_code}' \
    "$@")"
  rc=$?
  set -e

  LAST_HTTP_CODE="$code"

  if [[ $rc -ne 0 ]]; then
    echo "ERROR: curl failed (exit=$rc)" >&2
    debug_last_http
    return 1
  fi

  # Если после --location всё равно не 2xx — покажем Location/headers/body и упадём
  if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
    echo "ERROR: HTTP status is not 2xx" >&2
    debug_last_http
    return 1
  fi

  cat "$body_file"
}

json_token_from_stdin() {
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
  echo "Tip: ensure it's committed or set OPENAPI_SPEC to correct path." >&2
  exit 1
fi

login_payload="$(python - <<'PY'
import json,os
print(json.dumps({"login": os.environ["ROOT_EMAIL"], "password": os.environ["ROOT_PASSWORD"]}))
PY
)"

echo "Login with ROOT_PASSWORD..."
set +e
login_response="$(http POST "${API_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "$login_payload")"
login_rc=$?
set -e

if [[ $login_rc -ne 0 ]]; then
  echo "Login with ROOT_PASSWORD failed; trying CONTRACTS_PASSWORD (idempotent run)..." >&2

  login_payload="$(python - <<'PY'
import json,os
print(json.dumps({"login": os.environ["ROOT_EMAIL"], "password": os.environ["CONTRACTS_PASSWORD"]}))
PY
)"
  login_response="$(http POST "${API_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "$login_payload")"

  # если дошли сюда — пароль уже сменён, можно использовать этот токен как api_token
  api_token="$(printf "%s" "$login_response" | json_token_from_stdin)"
else
  # login ok — должен быть JSON
  if [[ ! -s "$LAST_HTTP_BODY" ]]; then
    echo "ERROR: empty login response body (expected JSON)" >&2
    debug_last_http
    exit 1
  fi
  login_token="$(printf "%s" "$login_response" | json_token_from_stdin)"

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
  change_response="$(http POST "${API_URL}/api/v1/auth/change-password" \
    -H "Authorization: Bearer ${login_token}" \
    -H "Content-Type: application/json" \
    -d "$change_payload")"
  change_rc=$?
  set -e

  if [[ $change_rc -eq 0 ]]; then
    if [[ ! -s "$LAST_HTTP_BODY" ]]; then
      echo "ERROR: empty change-password response body (expected JSON)" >&2
      debug_last_http
      exit 1
    fi
    api_token="$(printf "%s" "$change_response" | json_token_from_stdin)"
  else
    echo "Change-password failed; fallback to login with CONTRACTS_PASSWORD..." >&2
    login_payload="$(python - <<'PY'
import json,os
print(json.dumps({"login": os.environ["ROOT_EMAIL"], "password": os.environ["CONTRACTS_PASSWORD"]}))
PY
)"
    login_response="$(http POST "${API_URL}/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d "$login_payload")"
    api_token="$(printf "%s" "$login_response" | json_token_from_stdin)"
  fi
fi

# Schemathesis: для file-based схем base-url обязателен :contentReference[oaicite:4]{index=4}
schemathesis run "$OPENAPI_SPEC" \
  --base-url "$API_URL" \
  --header "Authorization: Bearer ${api_token}" \
  --method GET \
  --endpoint /api/v1/findings \
  --endpoint /api/v1/products \
  --endpoint /api/v1/import-jobs \
  --checks not_a_server_error \
  --validate-schema
