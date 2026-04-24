# ── Stage: Development (Vite dev server) ──
FROM node:20-alpine3.21 AS development

WORKDIR /app

COPY package.json package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ── Stage: Production Build ──
FROM node:20-alpine3.21 AS build

WORKDIR /app

COPY package.json package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY . .
RUN npm run build

# ── Stage: Production (nginx) ──
FROM nginx:stable-alpine3.21 AS production

COPY --from=build /app/dist /usr/share/nginx/html


RUN mkdir -p /var/cache/nginx /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp /var/run /var/log/nginx \
    && chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html
RUN printf 'server {\n\
    listen 8080;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    resolver 127.0.0.11 ipv6=off;\n\
    set $backend_upstream redlycoris-loadtest-backend:8080;\n\
    location /api/ {\n\
    proxy_pass http://$backend_upstream;\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
    location / {\n\
    try_files $uri $uri/ /index.html;\n\
    }\n\
    }\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
