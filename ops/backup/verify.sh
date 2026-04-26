#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

BOLD=""
DIM=""
RESET=""
C_INFO=""
C_OK=""
C_WARN=""
C_ERROR=""

if [[ -t 2 && -z "${NO_COLOR:-}" ]] && command -v tput >/dev/null 2>&1; then
  if [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
    BOLD="$(tput bold 2>/dev/null || true)"
    DIM="$(tput dim 2>/dev/null || true)"
    RESET="$(tput sgr0 2>/dev/null || true)"
    C_INFO="$(tput setaf 6 2>/dev/null || true)"
    C_OK="$(tput setaf 2 2>/dev/null || true)"
    C_WARN="$(tput setaf 3 2>/dev/null || true)"
    C_ERROR="$(tput setaf 1 2>/dev/null || true)"
  fi
fi

usage() {
  local out="${1:-1}"

  cat >&"$out" <<USAGE
${BOLD}Red Lycoris backup verification${RESET}

${BOLD}Описание${RESET}
  Проверяет backup-архив Red Lycoris без восстановления в основную среду.

  Скрипт:
    - распаковывает архив во временный каталог
    - проверяет manifest.json и SHA-256 artifacts
    - поднимает временные PostgreSQL/Redis контейнеры без host ports
    - восстанавливает pgdump.bin во временную PostgreSQL
    - при наличии redis.rdb проверяет, что Redis может стартовать с этим snapshot
    - выполняет smoke SQL checks по ключевым таблицам
    - сравнивает counts с manifest.expected_counts, если они есть

${BOLD}Использование${RESET}
  ${SCRIPT_NAME} <archive-path> [options]

${BOLD}Аргументы${RESET}
  <archive-path>
      Путь к backup-архиву redlycoris-*.tar.gz.

${BOLD}Опции${RESET}
  --no-redis
      Не проверять redis.rdb, даже если он есть в архиве.

  --postgres-image <image>
      Docker image PostgreSQL для временной проверки.
      По умолчанию: postgres:16-alpine

  --redis-image <image>
      Docker image Redis для временной проверки.
      По умолчанию: redis:7-alpine

  --timeout <seconds>
      Максимальное время ожидания готовности PostgreSQL/Redis.
      По умолчанию: 120

  -h, --help
      Показать эту справку.

${BOLD}Переменные окружения${RESET}
  POSTGRES_USER
      Пользователь PostgreSQL.
      По умолчанию: redlycoris

  POSTGRES_PASSWORD
      Пароль PostgreSQL.
      По умолчанию: redlycoris

  POSTGRES_DB
      Имя базы данных PostgreSQL.
      По умолчанию: redlycoris

${BOLD}Примеры${RESET}
  ${SCRIPT_NAME} ./backups/redlycoris-2026-04-26-120000.tar.gz

  ${SCRIPT_NAME} ./backups/redlycoris-2026-04-26-120000.tar.gz --no-redis

  ${SCRIPT_NAME} ./backups/redlycoris-2026-04-26-120000.tar.gz --timeout 180

${DIM}Скрипт не трогает основную среду Red Lycoris и удаляет временные контейнеры после проверки.${RESET}
USAGE
}

log() {
  local level="$1"
  shift

  local color=""
  case "$level" in
    "ИНФО") color="$C_INFO" ;;
    "ОК") color="$C_OK" ;;
    "ВНИМАНИЕ") color="$C_WARN" ;;
    "ОШИБКА") color="$C_ERROR" ;;
  esac

  printf '%s [%b%s%b] %s\n' \
    "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    "$color" "$level" "$RESET" \
    "$*" >&2
}

die() {
  log "ОШИБКА" "$*"
  exit 1
}

require_value() {
  local opt="$1"
  local value="${2:-}"

  if [[ -z "$value" || "$value" == --* ]]; then
    die "Для параметра ${opt} нужно указать значение."
  fi

  printf '%s' "$value"
}

ARCHIVE_PATH=""
RESTORE_REDIS=true
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
REDIS_IMAGE="${REDIS_IMAGE:-redis:7-alpine}"
TIMEOUT_SECONDS=120

while (($# > 0)); do
  case "$1" in
    -h|--help)
      usage 1
      exit 0
      ;;

    --no-redis)
      RESTORE_REDIS=false
      shift
      ;;

    --postgres-image)
      POSTGRES_IMAGE="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --postgres-image=*)
      POSTGRES_IMAGE="${1#*=}"
      [[ -n "$POSTGRES_IMAGE" ]] || die "Для параметра --postgres-image нужно указать значение."
      shift
      ;;

    --redis-image)
      REDIS_IMAGE="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --redis-image=*)
      REDIS_IMAGE="${1#*=}"
      [[ -n "$REDIS_IMAGE" ]] || die "Для параметра --redis-image нужно указать значение."
      shift
      ;;

    --timeout)
      TIMEOUT_SECONDS="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --timeout=*)
      TIMEOUT_SECONDS="${1#*=}"
      [[ -n "$TIMEOUT_SECONDS" ]] || die "Для параметра --timeout нужно указать значение."
      shift
      ;;

    --*)
      log "ОШИБКА" "Неизвестный аргумент: $1"
      echo >&2
      usage 2
      exit 1
      ;;

    *)
      if [[ -n "$ARCHIVE_PATH" ]]; then
        die "Можно указать только один archive-path."
      fi
      ARCHIVE_PATH="$1"
      shift
      ;;
  esac
done

if [[ -z "$ARCHIVE_PATH" ]]; then
  log "ОШИБКА" "Не указан путь к backup-архиву."
  echo >&2
  usage 2
  exit 1
fi

[[ -f "$ARCHIVE_PATH" ]] || die "Архив не найден: ${ARCHIVE_PATH}"

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]]; then
  die "Параметр --timeout должен быть неотрицательным целым числом."
fi

command -v docker >/dev/null 2>&1 || die "docker не найден в PATH."
command -v python3 >/dev/null 2>&1 || die "python3 не найден в PATH."
command -v tar >/dev/null 2>&1 || die "tar не найден в PATH."

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose недоступен. Проверь Docker Compose plugin."
fi

if [[ -f .env ]]; then
  log "ИНФО" "Загружаю переменные окружения из .env."
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-redlycoris}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-redlycoris}"
POSTGRES_DB="${POSTGRES_DB:-redlycoris}"

VERIFY_PROJECT="redlycoris-verify-$(date -u +%Y%m%d%H%M%S)-$$"
TMP_DIR="$(mktemp -d)"
VERIFY_COMPOSE_FILE="$TMP_DIR/docker-compose.verify.yml"

cleanup() {
  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" down -v >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

validate_tar_paths() {
  local archive="$1"
  local list_file

  list_file="$(mktemp)"

  if ! tar -tzf "$archive" > "$list_file"; then
    rm -f "$list_file"
    die "Не удалось прочитать tar.gz архив: ${archive}"
  fi

  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue

    if [[ "$entry" = /* || "$entry" == ".." || "$entry" == "../"* || "$entry" == *"/../"* || "$entry" == *"/.." ]]; then
      rm -f "$list_file"
      die "Архив содержит небезопасный путь: ${entry}"
    fi
  done < "$list_file"

  rm -f "$list_file"
}

wait_postgres() {
  local elapsed=0

  while ((elapsed < TIMEOUT_SECONDS)); do
    if docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T postgres \
      pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

wait_redis() {
  local elapsed=0

  while ((elapsed < TIMEOUT_SECONDS)); do
    if docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T redis \
      redis-cli PING >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

log "ИНФО" "Проверяю структуру tar.gz архива."
validate_tar_paths "$ARCHIVE_PATH"

log "ИНФО" "Распаковываю архив во временный каталог."
tar -C "$TMP_DIR" -xzf "$ARCHIVE_PATH"

log "ИНФО" "Проверяю manifest.json и SHA-256 artifacts."

if ! python3 - "$TMP_DIR" <<'PY'
import hashlib
import json
import pathlib
import sys

base = pathlib.Path(sys.argv[1])
manifest_path = base / "manifest.json"

if not manifest_path.exists():
    raise SystemExit("manifest.json не найден в архиве")

try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception as exc:
    raise SystemExit(f"Не удалось прочитать manifest.json: {exc}")

artifacts = manifest.get("artifacts")
if not isinstance(artifacts, list):
    raise SystemExit("manifest.json некорректен: поле artifacts должно быть массивом")

allowed_names = {"pgdump.bin", "redis.rdb"}
required_names = {"pgdump.bin"}
seen = set()

for artifact in artifacts:
    if not isinstance(artifact, dict):
        raise SystemExit("manifest.json некорректен: artifact должен быть объектом")

    name = artifact.get("name")
    expected_sha256 = artifact.get("sha256")

    if name not in allowed_names:
        raise SystemExit(f"manifest.json содержит неизвестный artifact: {name}")

    if not isinstance(expected_sha256, str) or len(expected_sha256) != 64:
        raise SystemExit(f"manifest.json содержит некорректный sha256 для artifact: {name}")

    path = base / name
    if not path.exists():
        raise SystemExit(f"Artifact отсутствует в архиве: {name}")

    actual_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual_sha256 != expected_sha256:
        raise SystemExit(
            f"SHA-256 mismatch для {name}: actual={actual_sha256}, expected={expected_sha256}"
        )

    seen.add(name)

missing = required_names - seen
if missing:
    raise SystemExit(f"В архиве отсутствуют обязательные artifacts: {', '.join(sorted(missing))}")

print("manifest integrity check passed")
PY
then
  die "Проверка manifest.json не пройдена."
fi

log "ОК" "Проверка manifest.json пройдена."

HAS_REDIS_DUMP=false
if [[ -f "$TMP_DIR/redis.rdb" ]]; then
  HAS_REDIS_DUMP=true
fi

cat > "$VERIFY_COMPOSE_FILE" <<YAML
services:
  postgres:
    image: ${POSTGRES_IMAGE}
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 2s
      timeout: 5s
      retries: 60

  redis:
    image: ${REDIS_IMAGE}
    command: ["redis-server", "--appendonly", "no"]
    tmpfs:
      - /data
    healthcheck:
      test: ["CMD", "redis-cli", "PING"]
      interval: 2s
      timeout: 5s
      retries: 60
YAML

log "ИНФО" "Поднимаю временную PostgreSQL для проверки backup."
docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" up -d postgres >/dev/null

if ! wait_postgres; then
  die "Временная PostgreSQL не стала ready за ${TIMEOUT_SECONDS} секунд."
fi

log "ОК" "Временная PostgreSQL готова."

log "ИНФО" "Копирую pgdump.bin во временный PostgreSQL контейнер."
docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" cp \
  "$TMP_DIR/pgdump.bin" postgres:/tmp/pgdump.bin >/dev/null

log "ИНФО" "Проверяю восстановление PostgreSQL dump через pg_restore."

if ! docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T postgres \
  pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    /tmp/pgdump.bin; then
  die "pg_restore завершился ошибкой. Backup нельзя считать восстановимым."
fi

docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T postgres \
  rm -f /tmp/pgdump.bin >/dev/null || true

log "ОК" "PostgreSQL dump успешно восстановлен."

if [[ "$HAS_REDIS_DUMP" == true && "$RESTORE_REDIS" == true ]]; then
  log "ИНФО" "Проверяю Redis snapshot."

  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" up -d redis >/dev/null
  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" stop redis >/dev/null

  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" cp \
    "$TMP_DIR/redis.rdb" redis:/data/dump.rdb >/dev/null

  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" start redis >/dev/null

  if ! wait_redis; then
    die "Redis не смог стартовать с восстановленным redis.rdb за ${TIMEOUT_SECONDS} секунд."
  fi

  REDIS_KEYS="$(
    docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T redis \
      redis-cli DBSIZE | tr -d '\r'
  )"

  log "ОК" "Redis snapshot успешно загружен. Keys: ${REDIS_KEYS}"
elif [[ "$HAS_REDIS_DUMP" == true && "$RESTORE_REDIS" == false ]]; then
  log "ВНИМАНИЕ" "redis.rdb есть в архиве, но Redis verification отключён параметром --no-redis."
else
  log "ВНИМАНИЕ" "redis.rdb не найден в архиве. Redis verification пропущен."
fi

log "ИНФО" "Выполняю smoke SQL checks."

SMOKE_COUNTS="$(
  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tAc "
      WITH required_tables(name) AS (
        VALUES ('findings'), ('projects'), ('users')
      )
      SELECT name
      FROM required_tables
      WHERE to_regclass('public.' || name) IS NULL;
    "
)"

if [[ -n "$SMOKE_COUNTS" ]]; then
  die "В восстановленной БД отсутствуют обязательные таблицы: ${SMOKE_COUNTS//$'\n'/, }"
fi

FINDINGS_COUNT="$(
  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tAc 'SELECT count(*) FROM findings;'
)"

PROJECTS_COUNT="$(
  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tAc 'SELECT count(*) FROM projects;'
)"

USERS_COUNT="$(
  docker compose -p "$VERIFY_PROJECT" -f "$VERIFY_COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tAc 'SELECT count(*) FROM users;'
)"

log "ОК" "Smoke SQL counts:"
echo "  findings: ${FINDINGS_COUNT}"
echo "  projects: ${PROJECTS_COUNT}"
echo "  users:    ${USERS_COUNT}"

log "ИНФО" "Сравниваю counts с manifest.expected_counts, если они есть."

if ! python3 - "$TMP_DIR" "$FINDINGS_COUNT" "$PROJECTS_COUNT" "$USERS_COUNT" <<'PY'
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
    print("expected_counts отсутствует в manifest.json, strict comparison пропущен")
    raise SystemExit(0)

if not isinstance(expected, dict):
    raise SystemExit("manifest.expected_counts должен быть объектом")

for key, value in actual.items():
    if key in expected and int(expected[key]) != value:
        raise SystemExit(
            f"Count mismatch для {key}: actual={value}, expected={expected[key]}"
        )

print("expected_counts comparison passed")
PY
then
  die "Сравнение counts с manifest.expected_counts не пройдено."
fi

log "ОК" "Backup verification passed."
echo "Проверка backup-архива успешно завершена."