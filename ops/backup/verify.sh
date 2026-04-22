#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <archive-path>"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

ARCHIVE_PATH="$1"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

POSTGRES_USER="${POSTGRES_USER:-redlycoris}"
POSTGRES_DB="${POSTGRES_DB:-redlycoris}"
COMPOSE_FILE="docker-compose.yml"
VERIFY_PROJECT="redlycoris-verify-$(date -u +%Y%m%d%H%M%S)"

TMP_DIR="$(mktemp -d)"
cleanup() {
  docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

tar -C "$TMP_DIR" -xzf "$ARCHIVE_PATH"

python3 - "$TMP_DIR" <<'PY'
import hashlib
import json
import pathlib
import sys

base = pathlib.Path(sys.argv[1])
manifest_path = base / "manifest.json"
if not manifest_path.exists():
    raise SystemExit("manifest.json not found in archive")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
for artifact in manifest.get("artifacts", []):
    path = base / artifact["name"]
    if not path.exists():
        raise SystemExit(f"Missing artifact: {artifact['name']}")
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    if sha != artifact["sha256"]:
        raise SystemExit(f"SHA256 mismatch for {artifact['name']}")
print("Manifest integrity check passed")
PY

docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" up -d postgres redis

for _ in $(seq 1 60); do
  if docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" cp "$TMP_DIR/pgdump.bin" postgres:/tmp/pgdump.bin >/dev/null
docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner /tmp/pgdump.bin
docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" exec -T postgres rm -f /tmp/pgdump.bin

if [[ -f "$TMP_DIR/redis.rdb" ]]; then
  docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" stop redis
  docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" cp "$TMP_DIR/redis.rdb" redis:/data/dump.rdb >/dev/null
  docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" start redis
fi

FINDINGS_COUNT="$(docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT count(*) FROM findings;')"
PROJECTS_COUNT="$(docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT count(*) FROM projects;')"
USERS_COUNT="$(docker compose -p "$VERIFY_PROJECT" -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT count(*) FROM users;')"

echo "Smoke SQL counts:"
echo "  findings: $FINDINGS_COUNT"
echo "  projects: $PROJECTS_COUNT"
echo "  users:    $USERS_COUNT"

python3 - "$TMP_DIR" "$FINDINGS_COUNT" "$PROJECTS_COUNT" "$USERS_COUNT" <<'PY'
import json
import pathlib
import sys

manifest = json.loads((pathlib.Path(sys.argv[1]) / "manifest.json").read_text(encoding="utf-8"))
actual = {
    "findings": int(sys.argv[2]),
    "projects": int(sys.argv[3]),
    "users": int(sys.argv[4]),
}
expected = manifest.get("expected_counts")
if not expected:
    print("expected_counts not present in manifest, skipping strict comparison")
    raise SystemExit(0)

for key, value in actual.items():
    if key in expected and int(expected[key]) != value:
        raise SystemExit(f"Count mismatch for {key}: actual={value}, expected={expected[key]}")
print("expected_counts comparison passed")
PY

echo "Verification passed"
