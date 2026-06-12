# Build context: repo root (.)
# Staging:
#   certinit-builder — compiles the TLS bootstrap binary (only used by production)
#   development      — Vite dev server (target=development)
#   build            — npm production build artefact
#   production       — nginx serving SPA + running certinit on startup

# ── Stage: certinit (statically linked, only referenced by production) ──
FROM golang:1.25-bookworm AS certinit-builder

WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/cmd/certinit/ ./cmd/certinit/
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /certinit ./cmd/certinit/

# ── Stage: Development (Vite dev server) ──
FROM node:20-bookworm-slim AS development

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node frontend/package.json frontend/package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY --chown=node:node frontend/. .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ── Stage: Production Build ──
FROM node:20-bookworm-slim AS build

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node frontend/package.json frontend/package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY --chown=node:node frontend/. .
RUN npm run build

# ── Stage: Production (nginx + certinit entrypoint) ──
FROM nginx:stable AS production

# certinit generates TLS files before nginx starts.
COPY --from=certinit-builder /certinit /certinit
COPY --from=build /app/dist /usr/share/nginx/html

# Writable temp paths for non-root nginx workers.
RUN mkdir -p \
        /tmp/nginx/client_temp /tmp/nginx/proxy_temp \
        /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp \
        /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp \
        /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp \
        /var/run /var/log/nginx \
    && chown -R nginx:nginx \
        /tmp/nginx /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

RUN cat > /etc/nginx/nginx.conf <<'NGINXCONF'
# nginx master runs as root to bind port 80/443; workers drop to the nginx user.
user nginx;
pid /tmp/nginx/nginx.pid;
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /dev/stdout;
    error_log /dev/stderr warn;

    sendfile on;
    keepalive_timeout 65;

    client_body_temp_path /tmp/nginx/client_temp;
    proxy_temp_path /tmp/nginx/proxy_temp;
    fastcgi_temp_path /tmp/nginx/fastcgi_temp;
    uwsgi_temp_path /tmp/nginx/uwsgi_temp;
    scgi_temp_path /tmp/nginx/scgi_temp;

    include /etc/nginx/conf.d/*.conf;
    # TLS server blocks written by certinit at runtime — glob is silent when absent (dev).
    include /etc/redlycoris/tls/conf.d/*.conf;
}
NGINXCONF

RUN cat > /etc/nginx/conf.d/default.conf <<'SERVERCONF'
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.11 ipv6=off;
    set $backend_upstream backend:8080;

    location /api/ {
        proxy_pass http://$backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
SERVERCONF

# Entrypoint: run certinit (generates/validates TLS), then start nginx.
# certinit exits 0 → nginx starts; exits 1 → container fails (bad cert).
# No USER directive: master must be root to bind ports 80/443;
# workers drop to the nginx user via the 'user nginx;' directive above.
RUN printf '#!/bin/sh\nset -e\n/certinit\nexec nginx -g "daemon off;"\n' \
    > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80 443 8080

# start_period covers certinit execution + nginx startup.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
