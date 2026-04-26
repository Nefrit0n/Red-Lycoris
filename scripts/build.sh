#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_NAME="$(basename "$0")"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
${BOLD}Red Lycoris build${RESET}

${BOLD}Описание${RESET}
  Собирает Docker images проекта Red Lycoris через Docker Compose.

  Скрипт прокидывает build metadata в Docker build:
    - VERSION
    - COMMIT
    - BUILD_DATE

${BOLD}Использование${RESET}
  ${SCRIPT_NAME} [options] [service...]

${BOLD}Аргументы${RESET}
  service
      Один или несколько сервисов из docker-compose.yml.
      Если не указаны — будут собраны все сервисы с build-секцией.

${BOLD}Опции${RESET}
  -f, --compose-file <path>
      Путь к docker-compose файлу.
      По умолчанию: ./docker-compose.yml

  --version <version>
      Версия приложения.
      Если не указана — читается из файла VERSION.

  --commit <commit>
      Git commit для build metadata.
      Если не указан — определяется автоматически через git.

  --build-date <date>
      Дата сборки в UTC ISO-8601.
      Если не указана — генерируется автоматически.

  --no-cache
      Собрать images без Docker build cache.

  --pull
      Перед сборкой подтянуть свежие base images.

  --progress <mode>
      Docker build progress mode.
      Например: auto, plain, tty, quiet.
      Для CI удобно использовать: plain

  --print-metadata
      Вывести build metadata и завершить работу без сборки.

  -h, --help
      Показать эту справку.

${BOLD}Примеры${RESET}
  ${SCRIPT_NAME}

  ${SCRIPT_NAME} backend frontend

  ${SCRIPT_NAME} --no-cache --pull backend

  ${SCRIPT_NAME} --progress plain

  ${SCRIPT_NAME} --version 0.2.0 --commit abc1234 backend

${BOLD}Переменные окружения${RESET}
  VERSION
      Можно передать версию через env вместо файла VERSION.

  COMMIT
      Можно передать commit через env.

  BUILD_DATE
      Можно передать дату сборки через env.

${DIM}Build args должны быть объявлены в Dockerfile через ARG VERSION, ARG COMMIT и ARG BUILD_DATE.${RESET}
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
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
VERSION="${VERSION:-}"
COMMIT="${COMMIT:-}"
BUILD_DATE="${BUILD_DATE:-}"

NO_CACHE=false
PULL=false
PRINT_METADATA=false
PROGRESS=""
SERVICES=()

# -----------------------------------------------------------------------------
# Arguments
# -----------------------------------------------------------------------------
while (($# > 0)); do
  case "$1" in
    -h|--help)
      usage 1
      exit 0
      ;;

    -f|--compose-file)
      COMPOSE_FILE="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --compose-file=*)
      COMPOSE_FILE="${1#*=}"
      [[ -n "$COMPOSE_FILE" ]] || die "Для параметра --compose-file нужно указать значение."
      shift
      ;;

    --version)
      VERSION="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --version=*)
      VERSION="${1#*=}"
      [[ -n "$VERSION" ]] || die "Для параметра --version нужно указать значение."
      shift
      ;;

    --commit)
      COMMIT="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --commit=*)
      COMMIT="${1#*=}"
      [[ -n "$COMMIT" ]] || die "Для параметра --commit нужно указать значение."
      shift
      ;;

    --build-date)
      BUILD_DATE="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --build-date=*)
      BUILD_DATE="${1#*=}"
      [[ -n "$BUILD_DATE" ]] || die "Для параметра --build-date нужно указать значение."
      shift
      ;;

    --no-cache)
      NO_CACHE=true
      shift
      ;;

    --pull)
      PULL=true
      shift
      ;;

    --progress)
      PROGRESS="$(require_value "$1" "${2:-}")"
      shift 2
      ;;

    --progress=*)
      PROGRESS="${1#*=}"
      [[ -n "$PROGRESS" ]] || die "Для параметра --progress нужно указать значение."
      shift
      ;;

    --print-metadata)
      PRINT_METADATA=true
      shift
      ;;

    --*)
      log "ОШИБКА" "Неизвестный аргумент: $1"
      echo >&2
      usage 2
      exit 1
      ;;

    *)
      SERVICES+=("$1")
      shift
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker не найден в PATH."

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose недоступен. Проверь Docker Compose plugin."
fi

[[ -f "$COMPOSE_FILE" ]] || die "Compose-файл не найден: ${COMPOSE_FILE}"

# -----------------------------------------------------------------------------
# Build metadata
# -----------------------------------------------------------------------------
if [[ -z "$VERSION" ]]; then
  VERSION_FILE="${ROOT_DIR}/VERSION"

  [[ -f "$VERSION_FILE" ]] || die "Файл VERSION не найден: ${VERSION_FILE}"

  VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
fi

[[ -n "$VERSION" ]] || die "VERSION пустой."

if [[ -z "$COMMIT" ]]; then
  COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"

  if [[ "$COMMIT" != "unknown" ]]; then
    if ! git -C "$ROOT_DIR" diff --quiet --ignore-submodules -- 2>/dev/null; then
      COMMIT="${COMMIT}-dirty"
    fi
  fi
fi

if [[ -z "$BUILD_DATE" ]]; then
  BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
fi

export VERSION COMMIT BUILD_DATE

# -----------------------------------------------------------------------------
# Compose config validation
# -----------------------------------------------------------------------------
log "ИНФО" "Проверяю Docker Compose config."

if ! docker compose -f "$COMPOSE_FILE" config >/dev/null; then
  die "Docker Compose config невалиден: ${COMPOSE_FILE}"
fi

log "ОК" "Docker Compose config валиден."

# -----------------------------------------------------------------------------
# Metadata output
# -----------------------------------------------------------------------------
log "ИНФО" "Build metadata:"
echo "  version:    ${VERSION}"
echo "  commit:     ${COMMIT}"
echo "  build_date: ${BUILD_DATE}"
echo "  compose:    ${COMPOSE_FILE}"

if ((${#SERVICES[@]} > 0)); then
  echo "  services:   ${SERVICES[*]}"
else
  echo "  services:   all buildable services"
fi

if [[ "$PRINT_METADATA" == true ]]; then
  exit 0
fi

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
BUILD_ARGS=(
  -f "$COMPOSE_FILE"
  build
  --build-arg "VERSION=${VERSION}"
  --build-arg "COMMIT=${COMMIT}"
  --build-arg "BUILD_DATE=${BUILD_DATE}"
)

if [[ "$NO_CACHE" == true ]]; then
  BUILD_ARGS+=(--no-cache)
fi

if [[ "$PULL" == true ]]; then
  BUILD_ARGS+=(--pull)
fi

if [[ -n "$PROGRESS" ]]; then
  BUILD_ARGS+=(--progress "$PROGRESS")
fi

if ((${#SERVICES[@]} > 0)); then
  BUILD_ARGS+=("${SERVICES[@]}")
fi

log "ИНФО" "Запускаю Docker build."

docker compose "${BUILD_ARGS[@]}"

log "ОК" "Docker images успешно собраны."