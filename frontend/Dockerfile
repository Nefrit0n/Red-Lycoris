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

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/http.conf /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
