#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/app}
VENV_BIN=${VENV_BIN:-/app/.venv/bin}
DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-lotus_warden.settings}

export DJANGO_SETTINGS_MODULE
export PYTHONPATH="$APP_DIR"

cd "$APP_DIR"

if [[ -x "$VENV_BIN/python" ]]; then
  PYTHON="$VENV_BIN/python"
  GUNICORN="$VENV_BIN/gunicorn"
else
  PYTHON=python
  GUNICORN=gunicorn
fi

$PYTHON manage.py migrate --noinput
$PYTHON manage.py collectstatic --noinput

mkdir -p /run/gunicorn

exec "$GUNICORN" \
  --config config/gunicorn.conf.py \
  lotus_warden.wsgi:application
