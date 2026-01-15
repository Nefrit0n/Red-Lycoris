FROM golang:1.22-alpine AS builder

WORKDIR /src

COPY services/go.mod ./
RUN go mod download

COPY services/ ./

ARG SERVICE
RUN CGO_ENABLED=0 go build -o /bin/service ./cmd/${SERVICE}

FROM alpine:3.19
RUN adduser -D -g '' appuser
USER appuser

COPY --from=builder /bin/service /usr/local/bin/service

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/service"]
