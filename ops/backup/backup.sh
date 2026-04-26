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
${BOLD}Red Lycoris backup${RESET}

${BOLD}Описание${RESET}
  Создаёт резервную копию Red Lycoris в tar.gz архиве.

  В архив попадает:
    - PostgreSQL dump в custom-format
    - Redis snapshot dump.rdb, если Redis не отключён
    - manifest.json с размером файлов и SHA-256

${BOLD}Использование${RESET}
  ${SCRIPT_NAME} --destination <path> [options]

${BOLD}Обязательные параметры${RESET}
  --destination <path>
      Каталог, куда будет сохранён архив резервной копии.

${BOLD}Опции${RESET}
  --retention-days <N>
      Удалять архивы старше N дней.
      По умолчанию: 7

  --include-redis
      Добавить Redis snapshot в резервную копию.
      Включено по умолчанию.

  --no-redis
      Не добавлять Redis snapshot в резервную копию.

  -h, --help
      Показать эту справку.

${BOLD}Примеры${RESET}
  ${SCRIPT_NAME} --destination ./backups

  ${SCRIPT_NAME} --destination /var/backups/redlycoris --retention-days 14

  ${SCRIPT_NAME} --destination ./backups --no-redis

${BOLD}Переменные окружения${RESET}
  POSTGRES_USER
      Пользователь PostgreSQL.
      По умолчанию: redlycoris

  POSTGRES_DB
      Имя базы данных PostgreSQL.
      По умолчанию: redlycoris

  APP_VERSION
      Версия приложения, которая будет записана в manifest.json.
      По умолчанию: 0.1.0b

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
DESTINATION=""
RETENTION_DAYS=7
INCLUDE_REDIS=true

# -----------------------------------------------------------------------------
# Arguments
# -----------------------------------------------------------------------------
while (($# > 0)); do
  case "$1" in
    --destination)
      DESTINATION="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --destination=*)
      DESTINATION="${1#*=}"
      if [[ -z "$DESTINATION" ]]; then
        die "Для параметра --destination нужно указать значение."
      fi
      shift
      ;;

    --retention-days)
      RETENTION_DAYS="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --retention-days=*)
      RETENTION_DAYS="${1#*=}"
      if [[ -z "$RETENTION_DAYS" ]]; then
        die "Для параметра --retention-days нужно указать значение."
      fi
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
      usage 1
      exit 0
      ;;

    *)
      log "ОШИБКА" "Неизвестный аргумент: $1"
      echo >&2
      usage 2
      exit 1
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------
if [[ -z "$DESTINATION" ]]; then
  log "ОШИБКА" "Не указан обязательный параметр: --destination."
  echo >&2
  usage 2
  exit 1
fi

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  die "Параметр --retention-days должен быть неотрицательным целым числом."
fi

command -v docker >/dev/null 2>&1 || die "docker не найден в PATH."
command -v python3 >/dev/null 2>&1 || die "python3 не найден в PATH."
command -v tar >/dev/null 2>&1 || die "tar не найден в PATH."

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
APP_VERSION="${APP_VERSION:-0.1.0b}"

# -----------------------------------------------------------------------------
# Docker Compose checks
# -----------------------------------------------------------------------------
log "ИНФО" "Проверяю запущенные сервисы Docker Compose."

RUNNING_SERVICES="$(docker compose ps --status running --quiet 2>/dev/null || true)"
if [[ -z "$RUNNING_SERVICES" ]]; then
  die "Docker Compose не содержит запущенных сервисов. Запусти проект перед созданием backup."
fi

# -----------------------------------------------------------------------------
# Backup workspace
# -----------------------------------------------------------------------------
log "ИНФО" "Готовлю каталог назначения: ${DESTINATION}"

mkdir -p "$DESTINATION"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# PostgreSQL backup
# -----------------------------------------------------------------------------
PG_DUMP_PATH="$TMP_DIR/pgdump.bin"

log "ИНФО" "Создаю PostgreSQL dump: database=${POSTGRES_DB}, user=${POSTGRES_USER}"

if ! docker compose exec -T \
  -e PGUSER="$POSTGRES_USER" \
  -e PGDATABASE="$POSTGRES_DB" \
  postgres sh -c 'pg_dump -U "$PGUSER" -d "$PGDATABASE" --format=custom --compress=9' \
  > "$PG_DUMP_PATH"; then
  die "Не удалось создать PostgreSQL dump."
fi

log "ОК" "PostgreSQL dump создан."

# -----------------------------------------------------------------------------
# Redis backup
# -----------------------------------------------------------------------------
if [[ "$INCLUDE_REDIS" == true ]]; then
  log "ИНФО" "Создаю Redis snapshot через BGSAVE."

  BEFORE_LASTSAVE="$(docker compose exec -T redis redis-cli LASTSAVE | tr -d '\r')"

  if ! docker compose exec -T redis redis-cli BGSAVE >/dev/null; then
    die "Не удалось запустить Redis BGSAVE."
  fi

  for _ in $(seq 1 60); do
    sleep 1

    CURRENT_LASTSAVE="$(docker compose exec -T redis redis-cli LASTSAVE | tr -d '\r')"
    if [[ "$CURRENT_LASTSAVE" != "$BEFORE_LASTSAVE" ]]; then
      break
    fi
  done

  CURRENT_LASTSAVE="$(docker compose exec -T redis redis-cli LASTSAVE | tr -d '\r')"
  if [[ "$CURRENT_LASTSAVE" == "$BEFORE_LASTSAVE" ]]; then
    die "Redis BGSAVE не завершился за 60 секунд."
  fi

  if ! docker compose cp redis:/data/dump.rdb "$TMP_DIR/redis.rdb" >/dev/null; then
    die "Не удалось скопировать Redis dump.rdb."
  fi

  log "ОК" "Redis snapshot добавлен в backup."
else
  log "ВНИМАНИЕ" "Redis snapshot пропущен: указан параметр --no-redis."
fi

# -----------------------------------------------------------------------------
# Manifest
# -----------------------------------------------------------------------------
CREATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

log "ИНФО" "Формирую manifest.json."

if ! python3 - "$TMP_DIR" "$APP_VERSION" "$CREATED_AT" <<'PY'
import hashlib
import json
import pathlib
import sys

base = pathlib.Path(sys.argv[1])
version = sys.argv[2]
created_at = sys.argv[3]

artifacts = []

for name in ("pgdump.bin", "redis.rdb"):
    path = base / name

    if not path.exists():
        continue

    data = path.read_bytes()
    artifacts.append(
        {
            "name": name,
            "size": path.stat().st_size,
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    )

manifest = {
    "version": version,
    "created_at": created_at,
    "artifacts": artifacts,
}

(base / "manifest.json").write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
PY
then
  die "Не удалось сформировать manifest.json."
fi

log "ОК" "manifest.json создан."

# -----------------------------------------------------------------------------
# Archive
# -----------------------------------------------------------------------------
ARCHIVE_NAME="redlycoris-$(date -u +"%Y-%m-%d-%H%M%S").tar.gz"
ARCHIVE_PATH="$DESTINATION/$ARCHIVE_NAME"

log "ИНФО" "Упаковываю backup в архив: ${ARCHIVE_NAME}"

if ! tar -C "$TMP_DIR" -czf "$ARCHIVE_PATH" .; then
  die "Не удалось создать tar.gz архив."
fi

log "ОК" "Архив создан."

# -----------------------------------------------------------------------------
# Retention
# -----------------------------------------------------------------------------
log "ИНФО" "Удаляю backup-архивы старше ${RETENTION_DAYS} дней."

find "$DESTINATION" \
  -maxdepth 1 \
  -type f \
  -name 'redlycoris-*.tar.gz' \
  -mtime +"$RETENTION_DAYS" \
  -delete

log "ОК" "Очистка старых backup-архивов завершена."

echo "Резервная копия создана: $ARCHIVE_PATH"