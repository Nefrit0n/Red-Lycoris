# ── Stage 1: Build ──
FROM golang:1.25.11-bookworm AS builder

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

# Build a tiny healthcheck binary for distroless runtime images.
RUN cat > /tmp/healthcheck.go <<'EOF'
package main

import (
	"net/http"
	"os"
	"time"
)

func main() {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8080/healthz")
	if err != nil {
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		os.Exit(1)
	}
}
EOF
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -ldflags="-s -w" -o /build/healthcheck /tmp/healthcheck.go

# ── Stage 2: Run ──
# Distroless runtime avoids package-manager RUN steps and keeps the image minimal.
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /build/redlycoris /app/redlycoris
COPY --from=builder /build/admin /app/admin
COPY --from=builder /build/migrations /app/migrations
COPY --from=builder /build/healthcheck /app/healthcheck

EXPOSE 8080
USER nonroot:nonroot
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD ["/app/healthcheck"]
ENTRYPOINT ["/app/redlycoris"]
