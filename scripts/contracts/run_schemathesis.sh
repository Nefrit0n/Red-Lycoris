#!/usr/bin/env bash
set -euo pipefail

API_URL=${API_URL:-http://localhost:8080}
OPENAPI_SPEC=${OPENAPI_SPEC:-backend/openapi.json}
ROOT_EMAIL=${ROOT_EMAIL:-root@localhost}
ROOT_PASSWORD=${ROOT_PASSWORD:-root}
CONTRACTS_PASSWORD=${CONTRACTS_PASSWORD:-root-contract-1234}

if ! command -v schemathesis >/dev/null 2>&1; then
  echo "schemathesis is required (pip install schemathesis)" >&2
  exit 1
fi

login_payload=$(python - <<'PY'
import json,os
print(json.dumps({"login": os.environ["ROOT_EMAIL"], "password": os.environ["ROOT_PASSWORD"]}))
PY
)
login_response=$(curl -sS -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "$login_payload")
login_token=$(printf "%s" "$login_response" | python - <<'PY'
import json,sys
print(json.load(sys.stdin)["data"]["token"])
PY
)

change_payload=$(python - <<'PY'
import json,os
print(json.dumps({"currentPassword": os.environ["ROOT_PASSWORD"], "newPassword": os.environ["CONTRACTS_PASSWORD"], "newPasswordConfirm": os.environ["CONTRACTS_PASSWORD"]}))
PY
)
change_response=$(curl -sS -X POST "$API_URL/api/v1/auth/change-password" \
  -H "Authorization: Bearer ${login_token}" \
  -H "Content-Type: application/json" \
  -d "$change_payload")
api_token=$(printf "%s" "$change_response" | python - <<'PY'
import json,sys
print(json.load(sys.stdin)["data"]["token"])
PY
)

schemathesis run "$OPENAPI_SPEC" \
  --base-url "$API_URL" \
  --header "Authorization: Bearer ${api_token}" \
  --method GET \
  --endpoint /api/v1/findings \
  --endpoint /api/v1/products \
  --endpoint /api/v1/import-jobs \
  --checks not_a_server_error \
  --validate-schema
