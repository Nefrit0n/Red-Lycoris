package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"

	"lotus-warden/services/internal/config"
	"lotus-warden/services/internal/events"
	internalnats "lotus-warden/services/internal/nats"
)

type ingestPayload struct {
	TenantID string `json:"tenant_id"`
	Product  string `json:"product"`
	Tool     string `json:"tool"`
	Report   string `json:"report"`
}

type ingestResponse struct {
	Status   string `json:"status"`
	Subject  string `json:"subject"`
	TraceID  string `json:"trace_id"`
	Received string `json:"received_at"`
}

func main() {
	cfg := config.Load("ingest")

	nc, err := internalnats.Connect(cfg.NatsURL, cfg.ServiceName)
	if err != nil {
		log.Fatalf("nats connection failed: %v", err)
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("jetstream init failed: %v", err)
	}

	app := fiber.New()

	app.Post("/v1/ingest", func(c *fiber.Ctx) error {
		var payload ingestPayload
		if err := c.BodyParser(&payload); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}

		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}

		traceID := uuid.NewString()

		ack, err := js.Publish(
			events.SubjectScansUploaded,
			payloadBytes,
			nats.MsgId(traceID),
		)
		if err != nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, err.Error())
		}

		log.Printf(
			"event published subject=%s stream=%s seq=%d duplicate=%v trace_id=%s",
			events.SubjectScansUploaded,
			ack.Stream,
			ack.Sequence,
			ack.Duplicate,
			traceID,
		)

		return c.JSON(ingestResponse{
			Status:   "queued",
			Subject:  events.SubjectScansUploaded,
			TraceID:  traceID,
			Received: time.Now().UTC().Format(time.RFC3339),
		})
	})

	log.Printf("ingest listening on %s", cfg.HTTPAddr)
	if err := app.Listen(cfg.HTTPAddr); err != nil {
		log.Fatalf("http server failed: %v", err)
	}
}
