# ── Stage 1: Build ──
FROM golang:1.25-bookworm AS builder

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
# Distroless runtime avoids package-manager RUN steps and keeps the image minimal.
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /build/redlycoris /app/redlycoris
COPY --from=builder /build/admin /app/admin
COPY --from=builder /build/migrations /app/migrations

EXPOSE 8080
ENTRYPOINT ["/app/redlycoris"]
