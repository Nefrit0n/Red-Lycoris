FROM golang:1.24-alpine AS base
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev
COPY . .
EXPOSE 8080
RUN go mod tidy
CMD ["go", "run", "./cmd/server"]


FROM base AS build
COPY . .
RUN go build -o /app/server ./cmd/server

FROM alpine:3.20 AS runtime
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=build /app/server /app/server
COPY --from=build /app/migrations /app/migrations
EXPOSE 8080
CMD ["/app/server"]
