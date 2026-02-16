FROM golang:1.24-alpine AS base
WORKDIR /app
RUN apk add --no-cache ca-certificates wget docker-cli
COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev
COPY . .
EXPOSE 8080
CMD ["go", "run", "./cmd/server"]


FROM base AS build
COPY . .
RUN mkdir -p /app/assets/bdu && \
    (wget -O /app/assets/bdu/vullist.xlsx https://bdu.fstec.ru/files/documents/vullist.xlsx || \
     wget --no-check-certificate -O /app/assets/bdu/vullist.xlsx https://bdu.fstec.ru/files/documents/vullist.xlsx) && \
    go build -ldflags="-s -w" -trimpath -o /app/server ./cmd/server && \
    go build -ldflags="-s -w" -trimpath -o /app/analysis_worker ./cmd/analysis_worker && \
    go build -ldflags="-s -w" -trimpath -o /app/intel_worker ./cmd/intel_worker && \
    go build -ldflags="-s -w" -trimpath -o /app/sbom_worker ./cmd/sbom_worker

FROM alpine:3.23 AS runtime
WORKDIR /app

# Install ca-certificates and wget for healthcheck
RUN apk add --no-cache ca-certificates wget

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=build /app/server /app/server
COPY --from=build /app/migrations /app/migrations
COPY --from=build /app/assets /app/assets

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["/app/server"]

# Analysis worker target
# Needs Docker CLI to spawn scanner containers (Docker-out-of-Docker)
FROM alpine:3.23 AS analysis-worker
ARG OPENGREP_VERSION=v1.16.0
ARG TARGETARCH
WORKDIR /app

RUN apk add --no-cache ca-certificates wget docker-cli && \
    case "$TARGETARCH" in \
        amd64) opengrep_asset="opengrep_musllinux_x86" ;; \
        arm64) opengrep_asset="opengrep_musllinux_aarch64" ;; \
        *) echo "Unsupported TARGETARCH=$TARGETARCH" && exit 1 ;; \
    esac && \
    wget -O /usr/local/bin/opengrep "https://github.com/opengrep/opengrep/releases/download/${OPENGREP_VERSION}/${opengrep_asset}" && \
    chmod +x /usr/local/bin/opengrep && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=build /app/analysis_worker /app/analysis_worker
RUN chown -R appuser:appgroup /app

CMD ["/app/analysis_worker"]

# Intel worker target
FROM alpine:3.23 AS intel-worker
WORKDIR /app

RUN apk add --no-cache ca-certificates wget && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=build /app/intel_worker /app/intel_worker
COPY --from=build /app/assets /app/assets
RUN chown -R appuser:appgroup /app

USER appuser
CMD ["/app/intel_worker"]

# SBOM worker target
FROM alpine:3.23 AS sbom-worker
WORKDIR /app

RUN apk add --no-cache ca-certificates wget && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=build /app/sbom_worker /app/sbom_worker
RUN chown -R appuser:appgroup /app

USER appuser
CMD ["/app/sbom_worker"]
