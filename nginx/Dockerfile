FROM node:alpine3.23 AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN rm -f package-lock.json && npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine3.23

# openssl нужен для генерации сертификата при старте
RUN apk add --no-cache openssl

# Create non-root user and configure nginx to run as non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    mkdir -p /var/cache/nginx /var/log/nginx /etc/nginx/ssl /docker-entrypoint.d && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/cache/nginx /var/log/nginx /var/run/nginx.pid /etc/nginx/ssl /docker-entrypoint.d

COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Скрипт автогенерации TLS при старте контейнера
COPY nginx/docker-entrypoint.d/10-generate-cert.sh /docker-entrypoint.d/10-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/10-generate-cert.sh && \
    chown appuser:appgroup /docker-entrypoint.d/10-generate-cert.sh && \
    chown -R appuser:appgroup /usr/share/nginx/html

USER appuser

EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
