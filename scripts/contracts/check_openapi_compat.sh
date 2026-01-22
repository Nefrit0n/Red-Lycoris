#!/usr/bin/env bash
set -euo pipefail

BASE_REF=${BASE_REF:-origin/main}
SPEC_PATH=${SPEC_PATH:-backend/openapi.json}

if ! command -v oasdiff >/dev/null 2>&1; then
  echo "oasdiff is required (go install github.com/tufin/oasdiff/cmd/oasdiff@latest)" >&2
  exit 1
fi

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  git fetch origin main
fi

base_spec=$(mktemp)
trap 'rm -f "$base_spec"' EXIT

git show "${BASE_REF}:${SPEC_PATH}" > "$base_spec"

oasdiff breaking "$base_spec" "$SPEC_PATH"
