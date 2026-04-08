#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

echo "=== Red Lycoris Seed Tool ==="
echo ""

# Check if .env exists and source it
if [ -f "$SCRIPT_DIR/../.env" ]; then
    set -a
    source "$SCRIPT_DIR/../.env"
    set +a
    echo "Loaded .env"
fi

echo "Building seed tool..."
cd "$BACKEND_DIR"
go build -o /tmp/redlycoris-seed ./cmd/seed

echo "Running seed..."
echo ""
/tmp/redlycoris-seed

echo ""
echo "=== Seed complete ==="
