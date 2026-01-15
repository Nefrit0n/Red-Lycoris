FROM golang:1.23-alpine AS builder

WORKDIR /src

# 1️⃣ Сначала только go.mod и go.sum
COPY services/go.mod services/go.sum ./
RUN go mod download

# 2️⃣ Потом весь код
COPY services/ .

ARG SERVICE
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -o /bin/service ./cmd/${SERVICE}

# ---- runtime ----
FROM alpine:3.19

RUN adduser -D app
USER app

COPY --from=builder /bin/service /service

EXPOSE 8080
ENTRYPOINT ["/service"]
