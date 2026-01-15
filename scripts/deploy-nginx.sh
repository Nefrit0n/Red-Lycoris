#!/usr/bin/env bash
set -euo pipefail

NGINX_CONF_SRC=${NGINX_CONF_SRC:-/app/config/nginx/lotus_warden.conf}
NGINX_CONF_DST=${NGINX_CONF_DST:-/etc/nginx/conf.d/lotus_warden.conf}

if [[ ! -f "$NGINX_CONF_SRC" ]]; then
  echo "NGINX config not found at $NGINX_CONF_SRC" >&2
  exit 1
fi

cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"
nginx -t
nginx -s reload
