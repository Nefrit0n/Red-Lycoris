#!/bin/sh
set -eu

SSL_DIR="${SSL_DIR:-/etc/nginx/ssl}"
CRT="${SSL_CRT:-$SSL_DIR/server.crt}"
KEY="${SSL_KEY:-$SSL_DIR/server.key}"

CN="${SSL_DOMAIN:-localhost}"
DAYS="${TLS_DAYS:-3650}"

# SAN обязателен для браузеров
SAN="${TLS_SAN:-DNS:${CN},DNS:*.${CN},DNS:localhost,IP:127.0.0.1}"

mkdir -p "$SSL_DIR"

if [ ! -s "$CRT" ] || [ ! -s "$KEY" ]; then
  echo "[tls] No cert found, generating self-signed for CN=${CN}"

  cat > /tmp/openssl.cnf <<EOF
[req]
prompt = no
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = ${CN}

[v3_req]
subjectAltName = ${SAN}
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

  openssl req -x509 -nodes -newkey rsa:2048 \
    -days "$DAYS" \
    -keyout "$KEY" \
    -out "$CRT" \
    -config /tmp/openssl.cnf

  chmod 600 "$KEY"
  chmod 644 "$CRT"

  echo "[tls] Generated: $CRT / $KEY"
else
  echo "[tls] Using existing cert: $CRT"
fi
