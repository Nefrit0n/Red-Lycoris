#!/usr/bin/env bash
set -euo pipefail

TARGET_URL=${1:-http://localhost/health/}
CONCURRENCY=${CONCURRENCY:-50}
REQUESTS=${REQUESTS:-1000}

if command -v hey >/dev/null 2>&1; then
  hey -c "$CONCURRENCY" -n "$REQUESTS" "$TARGET_URL"
else
  docker run --rm rakyll/hey -c "$CONCURRENCY" -n "$REQUESTS" "$TARGET_URL"
fi
