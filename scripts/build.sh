#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

VERSION=$(cat "${ROOT_DIR}/VERSION" | tr -d '[:space:]')
COMMIT=$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

export VERSION COMMIT BUILD_DATE

echo "Building RedLycoris ${VERSION} (${COMMIT}) built at ${BUILD_DATE}"

docker compose -f "${ROOT_DIR}/docker-compose.yml" build \
    --build-arg VERSION="${VERSION}" \
    --build-arg COMMIT="${COMMIT}" \
    --build-arg BUILD_DATE="${BUILD_DATE}"
