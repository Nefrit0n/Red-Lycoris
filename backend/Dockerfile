FROM golang:1.24-alpine AS base
WORKDIR /app
RUN apk add --no-cache ca-certificates wget
COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev
COPY . .
EXPOSE 8080
CMD ["go", "run", "./cmd/server"]


FROM base AS build
COPY . .
RUN go build -ldflags="-s -w" -trimpath -o /app/server ./cmd/server

FROM alpine:3.20 AS runtime
WORKDIR /app

# Install ca-certificates and wget for healthcheck
RUN apk add --no-cache ca-certificates wget

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=build /app/server /app/server
COPY --from=build /app/migrations /app/migrations

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["/app/server"]
