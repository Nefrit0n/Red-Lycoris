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
API_PORT="${API_PORT:-8080}"

read -r -p "This will DROP and RECREATE the database. Type 'restore' to confirm: " CONFIRM
if [[ "$CONFIRM" != "restore" ]]; then
  echo "Restore aborted."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

tar -C "$TMP_DIR" -xzf "$ARCHIVE_PATH"

if [[ ! -f "$TMP_DIR/manifest.json" ]]; then
  echo "manifest.json not found in archive" >&2
  exit 1
fi

python3 - "$TMP_DIR" <<'PY'
import hashlib
import json
import pathlib
import sys

base = pathlib.Path(sys.argv[1])
manifest = json.loads((base / "manifest.json").read_text(encoding="utf-8"))
for artifact in manifest.get("artifacts", []):
    name = artifact["name"]
    expected = artifact["sha256"]
    path = base / name
    if not path.exists():
        raise SystemExit(f"Missing artifact: {name}")
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected:
        raise SystemExit(f"SHA256 mismatch for {name}: {actual} != {expected}")
print("Manifest integrity check passed")
PY

docker compose stop backend

docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\";"

docker compose cp "$TMP_DIR/pgdump.bin" postgres:/tmp/pgdump.bin >/dev/null
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner /tmp/pgdump.bin
docker compose exec -T postgres rm -f /tmp/pgdump.bin

if [[ -f "$TMP_DIR/redis.rdb" ]]; then
  docker compose stop redis
  docker compose cp "$TMP_DIR/redis.rdb" redis:/data/dump.rdb >/dev/null
  docker compose start redis
fi

docker compose start backend

for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${API_PORT}/readyz" >/dev/null; then
    echo "Restore completed and readiness probe is healthy"
    exit 0
  fi
  sleep 2
done

echo "Restore completed, but readiness probe did not become healthy in time" >&2
exit 1
