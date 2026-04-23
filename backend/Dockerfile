# ── Stage 1: Build ──
FROM golang:1.25-alpine3.21 AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build \
  -ldflags="-s -w \
  -X redlycoris/internal/version.Version=${VERSION} \
  -X redlycoris/internal/version.Commit=${COMMIT} \
  -X redlycoris/internal/version.Date=${BUILD_DATE}" \
  -o /build/redlycoris ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -ldflags="-s -w" -o /build/admin ./cmd/admin

# ── Stage 2: Run ──
FROM alpine:3.21

RUN apk add --no-cache --upgrade ca-certificates tzdata curl nghttp2-libs musl musl-utils

RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /sbin/nologin -D app

WORKDIR /app

COPY --from=builder /build/redlycoris .
COPY --from=builder /build/admin .
COPY --from=builder /build/migrations ./migrations

RUN chown -R app:app /app

USER 1000:1000

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["./redlycoris"]
