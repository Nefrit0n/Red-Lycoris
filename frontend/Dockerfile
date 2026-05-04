# ── Stage: Development (Vite dev server) ──
FROM node:20-bookworm-slim AS development

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package.json package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY --chown=node:node . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ── Stage: Production Build ──
FROM node:20-bookworm-slim AS build

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package.json package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY --chown=node:node . .
RUN npm run build

# ── Stage: Production (nginx) ──
FROM nginx:stable AS production

COPY --from=build /app/dist /usr/share/nginx/html

# Keep nginx writable paths away from /var/cache to support hardened/non-root runs.
RUN mkdir -p /tmp/nginx/client_temp /tmp/nginx/proxy_temp /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp \
    /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp \
    /var/run /var/log/nginx \
    && chown -R nginx:nginx /tmp/nginx /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

RUN cat > /etc/nginx/nginx.conf <<'NGINXCONF'
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

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
