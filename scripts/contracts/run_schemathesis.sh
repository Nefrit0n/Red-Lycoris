#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
OPENAPI_SPEC="${OPENAPI_SPEC:-backend/openapi.json}"
ROOT_EMAIL="${ROOT_EMAIL:-root@localhost}"
ROOT_PASSWORD="${ROOT_PASSWORD:-root}"
CONTRACTS_PASSWORD="${CONTRACTS_PASSWORD:-root-contract-1234}"

export API_URL OPENAPI_SPEC ROOT_EMAIL ROOT_PASSWORD CONTRACTS_PASSWORD

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: '$1' is required" >&2
    exit 1
  }
}

extract_token() {
  python - <<'PY' 2>/dev/null || true
import json, sys
try:
    obj = json.load(sys.stdin)
    print(obj.get("data", {}).get("token", "") or "")
except Exception:
    print("")
PY
}

http_post_json() {
  # prints body only (can be empty). never fails the script
  local url="$1"
  local data="$2"
  local auth="${3:-}"
  if [[ -n "$auth" ]]; then
    curl -sS -X POST "$url" \
      -H "Authorization: Bearer ${auth}" \
      -H "Content-Type: application/json" \
      -d "$data" || true
  else
    curl -sS -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$data" || true
  fi
}

wait_for_health() {
  echo "Checking API health: ${API_URL}/health"
  for i in {1..60}; do
    body="$(curl -sf "${API_URL}/health" 2>/dev/null || true)"
    if [[ "$body" == *'"status"'* ]]; then
      echo "API healthy: $body"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: API did not become healthy at ${API_URL}/health" >&2
  curl -sS -D - "${API_URL}/health" -o - || true
  exit 1
}

login_with_password() {
  local password="$1"
  local payload
  payload="$(
    LOGIN_PASSWORD="$password" python - <<'PY'
import json, os
print(json.dumps({"login": os.environ["ROOT_EMAIL"], "password": os.environ["LOGIN_PASSWORD"]}))
PY
  )"

  # retry, потому что на старте иногда бывает пустой body
  local resp token
  for i in {1..20}; do
    resp="$(http_post_json "${API_URL}/api/v1/auth/login" "$payload")"
    if [[ -n "$resp" ]]; then
      token="$(printf '%s' "$resp" | extract_token)"
      if [[ -n "$token" ]]; then
        echo "$token"
        return 0
      fi
    fi
    sleep 2
  done

  echo ""
  return 0
}

change_password() {
  local login_token="$1"
  local payload resp token
  payload="$(
    python - <<'PY'
import json, os
print(json.dumps({
  "currentPassword": os.environ["ROOT_PASSWORD"],
  "newPassword": os.environ["CONTRACTS_PASSWORD"],
  "newPasswordConfirm": os.environ["CONTRACTS_PASSWORD"],
}))
PY
  )"

  resp="$(http_post_json "${API_URL}/api/v1/auth/change-password" "$payload" "$login_token")"
  token="$(printf '%s' "$resp" | extract_token)"
  printf '%s' "$token"
}

main() {
  require curl
  require python
  require schemathesis

  if [[ ! -f "$OPENAPI_SPEC" ]]; then
    echo "ERROR: OpenAPI spec not found at: $OPENAPI_SPEC" >&2
    exit 1
  fi

  wait_for_health

  echo "Login with ROOT_PASSWORD..."
  login_token="$(login_with_password "$ROOT_PASSWORD")"

  if [[ -z "$login_token" ]]; then
    echo "Login with ROOT_PASSWORD failed; trying CONTRACTS_PASSWORD..."
    login_token="$(login_with_password "$CONTRACTS_PASSWORD")"
    if [[ -z "$login_token" ]]; then
      echo "ERROR: login did not succeed" >&2
      echo "---- DEBUG login response headers/body ----" >&2
      curl -sS -D - -X POST "${API_URL}/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"login\":\"${ROOT_EMAIL}\",\"password\":\"${ROOT_PASSWORD}\"}" -o - || true
      exit 1
    fi
  fi

  api_token="$login_token"

  # Пытаемся сменить пароль — но НЕ падаем, если уже сменён / политика другая
  echo "Change password (may fail if already changed)..."
  maybe_new_token="$(change_password "$login_token")"
  if [[ -n "$maybe_new_token" ]]; then
    api_token="$maybe_new_token"
  fi

  # В новых версиях Schemathesis базовый URL задаётся через --url :contentReference[oaicite:2]{index=2}
  # Фильтрация: --include-path / --include-method :contentReference[oaicite:3]{index=3}
  schemathesis run "$OPENAPI_SPEC" \
    --url "$API_URL" \
    --header "Authorization: Bearer ${api_token}" \
    --include-method GET \
    --include-path /api/v1/findings \
    --include-path /api/v1/products \
    --include-path /api/v1/import-jobs \
    --checks not_a_server_error \
    --max-examples 25
}

main "$@"
