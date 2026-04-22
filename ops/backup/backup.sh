#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --destination <path> [--retention-days <N>] [--include-redis|--no-redis]

Options:
  --destination <path>   Backup destination directory (required)
  --retention-days <N>   Delete backups older than N days (default: 7)
  --include-redis        Include Redis snapshot (default)
  --no-redis             Skip Redis snapshot
  -h, --help             Show this help
USAGE
}

DESTINATION=""
RETENTION_DAYS=7
INCLUDE_REDIS=true

while (($# > 0)); do
  case "$1" in
    --destination)
      DESTINATION="${2:-}"
      shift 2
      ;;
    --destination=*)
      DESTINATION="${1#*=}"
      shift
      ;;
    --retention-days)
      RETENTION_DAYS="${2:-}"
      shift 2
      ;;
    --retention-days=*)
      RETENTION_DAYS="${1#*=}"
      shift
      ;;
    --include-redis)
      INCLUDE_REDIS=true
      shift
      ;;
    --no-redis)
      INCLUDE_REDIS=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$DESTINATION" ]]; then
  echo "--destination is required" >&2
  usage
  exit 1
fi

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "--retention-days must be a non-negative integer" >&2
  exit 1
fi

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

POSTGRES_USER="${POSTGRES_USER:-redlycoris}"
POSTGRES_DB="${POSTGRES_DB:-redlycoris}"
APP_VERSION="${APP_VERSION:-0.1.0b}"

if ! docker compose ps --status running --quiet | grep -q .; then
  echo "docker compose is not running any services" >&2
  exit 1
fi

mkdir -p "$DESTINATION"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# PostgreSQL custom-format dump
PG_DUMP_PATH="$TMP_DIR/pgdump.bin"
docker compose exec -T postgres sh -c "pg_dump -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" --format=custom --compress=9" > "$PG_DUMP_PATH"

if [[ "$INCLUDE_REDIS" == true ]]; then
  BEFORE_LASTSAVE="$(docker compose exec -T redis redis-cli LASTSAVE | tr -d '\r')"
  docker compose exec -T redis redis-cli BGSAVE >/dev/null

  for _ in $(seq 1 60); do
    sleep 1
    CURRENT_LASTSAVE="$(docker compose exec -T redis redis-cli LASTSAVE | tr -d '\r')"
    if [[ "$CURRENT_LASTSAVE" != "$BEFORE_LASTSAVE" ]]; then
      break
    fi
  done

  CURRENT_LASTSAVE="$(docker compose exec -T redis redis-cli LASTSAVE | tr -d '\r')"
  if [[ "$CURRENT_LASTSAVE" == "$BEFORE_LASTSAVE" ]]; then
    echo "Timed out waiting for Redis BGSAVE completion" >&2
    exit 1
  fi

  docker compose cp redis:/data/dump.rdb "$TMP_DIR/redis.rdb" >/dev/null
fi

MANIFEST_PATH="$TMP_DIR/manifest.json"
CREATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 - "$TMP_DIR" "$APP_VERSION" "$CREATED_AT" <<'PY'
import hashlib
import json
import pathlib
import sys

base = pathlib.Path(sys.argv[1])
version = sys.argv[2]
created_at = sys.argv[3]
artifacts = []
for name in ("pgdump.bin", "redis.rdb"):
    p = base / name
    if not p.exists():
        continue
    data = p.read_bytes()
    artifacts.append(
        {
            "name": name,
            "size": p.stat().st_size,
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    )
manifest = {
    "version": version,
    "created_at": created_at,
    "artifacts": artifacts,
}
(base / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

ARCHIVE_NAME="redlycoris-$(date -u +"%Y-%m-%d-%H%M%S").tar.gz"
tar -C "$TMP_DIR" -czf "$DESTINATION/$ARCHIVE_NAME" .

find "$DESTINATION" -maxdepth 1 -type f -name 'redlycoris-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $DESTINATION/$ARCHIVE_NAME"
