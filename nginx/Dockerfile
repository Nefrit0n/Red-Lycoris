FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

# Create non-root user and configure nginx to run as non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown appuser:appgroup /var/run/nginx.pid && \
    mkdir -p /etc/nginx/ssl && \
    chown -R appuser:appgroup /etc/nginx/ssl

COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy SSL certificates (must exist before building)
# For development: run nginx/ssl/generate-certs.sh first
COPY nginx/ssl/server.crt /etc/nginx/ssl/server.crt
COPY nginx/ssl/server.key /etc/nginx/ssl/server.key

# Ensure proper permissions
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown appuser:appgroup /etc/nginx/ssl/server.crt && \
    chown appuser:appgroup /etc/nginx/ssl/server.key && \
    chmod 644 /etc/nginx/ssl/server.crt && \
    chmod 600 /etc/nginx/ssl/server.key

USER appuser

# Expose both HTTP (for redirect) and HTTPS ports
EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
