#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

# -----------------------------------------------------------------------------
# Colors
# -----------------------------------------------------------------------------
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

# -----------------------------------------------------------------------------
# CLI output
# -----------------------------------------------------------------------------
usage() {
  local out="${1:-1}"

  cat >&"$out" <<USAGE
${BOLD}Red Lycoris restore${RESET}

${BOLD}Описание${RESET}
  Восстанавливает Red Lycoris из backup-архива, созданного backup-скриптом.

  Операция опасная:
    - текущая база PostgreSQL будет удалена и создана заново
    - данные будут восстановлены из pgdump.bin
    - Redis будет восстановлен из redis.rdb, если artifact есть в архиве
    - application services будут остановлены на время восстановления

${BOLD}Использование${RESET}
  ${SCRIPT_NAME} <archive-path> [options]

${BOLD}Аргументы${RESET}
  <archive-path>
      Путь к backup-архиву redlycoris-*.tar.gz.

${BOLD}Опции${RESET}
  -y, --yes
      Не спрашивать интерактивное подтверждение.
      Использовать только в CI/CD или автоматизированном recovery.

  --no-redis
      Не восстанавливать Redis, даже если redis.rdb есть в архиве.

  --skip-readiness
      Не ждать успешного ответа /readyz после восстановления.

  --readiness-timeout <seconds>
      Максимальное время ожидания readiness probe.
      По умолчанию: 120 секунд.

  -h, --help
      Показать эту справку.

${BOLD}Переменные окружения${RESET}
  POSTGRES_USER
      Пользователь PostgreSQL.
      По умолчанию: redlycoris

  POSTGRES_DB
      Имя базы данных PostgreSQL.
      По умолчанию: redlycoris

  API_PORT
      Порт backend API для проверки /readyz.
      По умолчанию: 8080

  APP_SERVICES
      Список application-сервисов Docker Compose, которые нужно остановить
      перед restore и запустить после restore.

      По умолчанию:
        backend analysis_worker intel_worker sbom_worker sbom_transitive_worker

${BOLD}Примеры${RESET}
  ${SCRIPT_NAME} ./backups/redlycoris-2026-04-26-120000.tar.gz

  ${SCRIPT_NAME} ./backups/redlycoris-2026-04-26-120000.tar.gz --no-redis

  ${SCRIPT_NAME} ./backups/redlycoris-2026-04-26-120000.tar.gz --yes --readiness-timeout 180

${DIM}Подсказка: переменные также могут быть загружены из файла .env в текущем каталоге.${RESET}
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

# -----------------------------------------------------------------------------
# Defaults
# -----------------------------------------------------------------------------
ARCHIVE_PATH=""
ASSUME_YES=false
RESTORE_REDIS=true
SKIP_READINESS=false
READINESS_TIMEOUT_SECONDS=120

# Важно: список сервисов можно переопределить через APP_SERVICES.
APP_SERVICES="${APP_SERVICES:-backend analysis_worker intel_worker sbom_worker sbom_transitive_worker}"

# -----------------------------------------------------------------------------
# Arguments
# -----------------------------------------------------------------------------
while (($# > 0)); do
  case "$1" in
    -h|--help)
      usage 1
      exit 0
      ;;

    -y|--yes)
      ASSUME_YES=true
      shift
      ;;

    --no-redis)
      RESTORE_REDIS=false
      shift
      ;;

    --skip-readiness)
      SKIP_READINESS=true
      shift
      ;;

    --readiness-timeout)
      READINESS_TIMEOUT_SECONDS="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --readiness-timeout=*)
      READINESS_TIMEOUT_SECONDS="${1#*=}"
      if [[ -z "$READINESS_TIMEOUT_SECONDS" ]]; then
        die "Для параметра --readiness-timeout нужно указать значение."
      fi
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

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------
if [[ -z "$ARCHIVE_PATH" ]]; then
  log "ОШИБКА" "Не указан путь к backup-архиву."
  echo >&2
  usage 2
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  die "Архив не найден: ${ARCHIVE_PATH}"
fi

if ! [[ "$READINESS_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]]; then
  die "Параметр --readiness-timeout должен быть неотрицательным целым числом."
fi

command -v docker >/dev/null 2>&1 || die "docker не найден в PATH."
command -v python3 >/dev/null 2>&1 || die "python3 не найден в PATH."
command -v tar >/dev/null 2>&1 || die "tar не найден в PATH."

if [[ "$SKIP_READINESS" == false ]]; then
  command -v curl >/dev/null 2>&1 || die "curl не найден в PATH."
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose недоступен. Проверь Docker Compose plugin."
fi

# -----------------------------------------------------------------------------
# Environment
# -----------------------------------------------------------------------------
if [[ -f .env ]]; then
  log "ИНФО" "Загружаю переменные окружения из .env."
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-redlycoris}"
POSTGRES_DB="${POSTGRES_DB:-redlycoris}"
API_PORT="${API_PORT:-8080}"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
service_exists() {
  local service="$1"
  docker compose config --services | grep -Fxq "$service"
}

service_running() {
  local service="$1"
  docker compose ps --services --status running 2>/dev/null | grep -Fxq "$service"
}

ensure_service_running() {
  local service="$1"

  if ! service_exists "$service"; then
    die "Сервис ${service} не найден в docker-compose конфигурации."
  fi

  if ! service_running "$service"; then
    log "ИНФО" "Запускаю сервис ${service}."
    docker compose up -d "$service" >/dev/null
  fi
}

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

STOPPED_APP_SERVICES=()

stop_app_services() {
  local services=()
  local service=""

  read -r -a services <<< "$APP_SERVICES"

  for service in "${services[@]}"; do
    if ! service_exists "$service"; then
      log "ВНИМАНИЕ" "Application service не найден в compose-конфигурации, пропускаю: ${service}"
      continue
    fi

    if service_running "$service"; then
      STOPPED_APP_SERVICES+=("$service")
    fi
  done

  if ((${#STOPPED_APP_SERVICES[@]} > 0)); then
    log "ИНФО" "Останавливаю application services: ${STOPPED_APP_SERVICES[*]}"
    docker compose stop "${STOPPED_APP_SERVICES[@]}" >/dev/null
    log "ОК" "Application services остановлены."
  else
    log "ВНИМАНИЕ" "Запущенные application services не найдены. Продолжаю restore."
  fi
}

start_app_services() {
  local services=()
  local existing_services=()
  local service=""

  read -r -a services <<< "$APP_SERVICES"

  for service in "${services[@]}"; do
    if service_exists "$service"; then
      existing_services+=("$service")
    fi
  done

  if ((${#existing_services[@]} > 0)); then
    log "ИНФО" "Запускаю application services: ${existing_services[*]}"
    docker compose start "${existing_services[@]}" >/dev/null
    log "ОК" "Application services запущены."
  else
    log "ВНИМАНИЕ" "Нет application services для запуска."
  fi
}

# -----------------------------------------------------------------------------
# Archive extraction
# -----------------------------------------------------------------------------
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log "ИНФО" "Проверяю структуру tar.gz архива."
validate_tar_paths "$ARCHIVE_PATH"

log "ИНФО" "Распаковываю архив во временный каталог."
tar -C "$TMP_DIR" -xzf "$ARCHIVE_PATH"

if [[ ! -f "$TMP_DIR/manifest.json" ]]; then
  die "manifest.json не найден в архиве."
fi

# -----------------------------------------------------------------------------
# Manifest integrity
# -----------------------------------------------------------------------------
log "ИНФО" "Проверяю целостность manifest.json и artifacts."

if ! python3 - "$TMP_DIR" <<'PY'
import hashlib
import json
import pathlib
import sys

base = pathlib.Path(sys.argv[1])
manifest_path = base / "manifest.json"

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
PY
then
  die "Проверка manifest.json не пройдена."
fi

log "ОК" "Проверка целостности backup-архива пройдена."

HAS_REDIS_DUMP=false
if [[ -f "$TMP_DIR/redis.rdb" ]]; then
  HAS_REDIS_DUMP=true
fi

# -----------------------------------------------------------------------------
# Confirmation
# -----------------------------------------------------------------------------
log "ВНИМАНИЕ" "Будет удалена и пересоздана база PostgreSQL: ${POSTGRES_DB}"
log "ВНИМАНИЕ" "Архив для восстановления: ${ARCHIVE_PATH}"

if [[ "$HAS_REDIS_DUMP" == true && "$RESTORE_REDIS" == true ]]; then
  log "ВНИМАНИЕ" "Redis будет восстановлен из redis.rdb."
elif [[ "$HAS_REDIS_DUMP" == true && "$RESTORE_REDIS" == false ]]; then
  log "ВНИМАНИЕ" "redis.rdb есть в архиве, но Redis restore отключён параметром --no-redis."
else
  log "ВНИМАНИЕ" "redis.rdb не найден в архиве. Redis restore будет пропущен."
fi

if [[ "$ASSUME_YES" == false ]]; then
  CONFIRM=""
  echo >&2
  read -r -p "Для подтверждения введи: restore ${POSTGRES_DB}: " CONFIRM || true

  if [[ "$CONFIRM" != "restore ${POSTGRES_DB}" ]]; then
    die "Restore отменён пользователем."
  fi
fi

# -----------------------------------------------------------------------------
# Restore
# -----------------------------------------------------------------------------
ensure_service_running "postgres"

stop_app_services

# PostgreSQL restore
log "ИНФО" "Завершаю активные подключения к базе ${POSTGRES_DB}."

docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -v dbname="$POSTGRES_DB" \
  -U "$POSTGRES_USER" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'dbname' AND pid <> pg_backend_pid();" \
  >/dev/null

log "ИНФО" "Удаляю базу PostgreSQL: ${POSTGRES_DB}"

docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -v dbname="$POSTGRES_DB" \
  -U "$POSTGRES_USER" \
  -d postgres \
  -c 'DROP DATABASE IF EXISTS :"dbname";' \
  >/dev/null

log "ИНФО" "Создаю базу PostgreSQL: ${POSTGRES_DB}"

docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -v dbname="$POSTGRES_DB" \
  -U "$POSTGRES_USER" \
  -d postgres \
  -c 'CREATE DATABASE :"dbname";' \
  >/dev/null

log "ИНФО" "Копирую PostgreSQL dump в контейнер postgres."

docker compose cp "$TMP_DIR/pgdump.bin" postgres:/tmp/redlycoris-restore-pgdump.bin >/dev/null

log "ИНФО" "Восстанавливаю PostgreSQL dump через pg_restore."

if ! docker compose exec -T postgres pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  /tmp/redlycoris-restore-pgdump.bin; then
  docker compose exec -T postgres rm -f /tmp/redlycoris-restore-pgdump.bin >/dev/null || true
  die "PostgreSQL restore завершился ошибкой."
fi

docker compose exec -T postgres rm -f /tmp/redlycoris-restore-pgdump.bin >/dev/null || true

log "ОК" "PostgreSQL восстановлен."

# Redis restore
if [[ "$HAS_REDIS_DUMP" == true && "$RESTORE_REDIS" == true ]]; then
  if ! service_exists "redis"; then
    die "В архиве есть redis.rdb, но сервис redis не найден в docker-compose конфигурации."
  fi

  if service_running "redis"; then
    REDIS_APPENDONLY="$(
      docker compose exec -T redis sh -c "redis-cli CONFIG GET appendonly | tail -n 1" 2>/dev/null \
        | tr -d '\r' \
        || true
    )"

    if [[ "$REDIS_APPENDONLY" == "yes" ]]; then
      die "В Redis включён appendonly/AOF. Простой restore из dump.rdb небезопасен: Redis может загрузить AOF вместо RDB."
    fi
  fi

  log "ИНФО" "Останавливаю Redis перед заменой dump.rdb."
  docker compose stop redis >/dev/null

  log "ИНФО" "Копирую redis.rdb в контейнер redis."
  docker compose cp "$TMP_DIR/redis.rdb" redis:/data/dump.rdb >/dev/null

  log "ИНФО" "Запускаю Redis."
  docker compose start redis >/dev/null

  log "ОК" "Redis восстановлен."
else
  log "ВНИМАНИЕ" "Redis restore пропущен."
fi

# Start app
start_app_services

# Readiness
if [[ "$SKIP_READINESS" == true ]]; then
  log "ОК" "Restore завершён. Readiness probe пропущен."
  echo "Восстановление завершено."
  exit 0
fi

log "ИНФО" "Ожидаю readiness probe: http://localhost:${API_PORT}/readyz"

elapsed=0
while ((elapsed < READINESS_TIMEOUT_SECONDS)); do
  if curl -fsS "http://localhost:${API_PORT}/readyz" >/dev/null; then
    log "ОК" "Restore завершён, readiness probe здоров."
    echo "Восстановление завершено успешно."
    exit 0
  fi

  sleep 2
  elapsed=$((elapsed + 2))
done

die "Restore завершён, но readiness probe не стал healthy за ${READINESS_TIMEOUT_SECONDS} секунд."