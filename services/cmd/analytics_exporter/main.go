package main

import (
	"log"
	"time"

	"github.com/nats-io/nats.go"

	"lotus-warden/services/internal/config"
	"lotus-warden/services/internal/events"
	internalnats "lotus-warden/services/internal/nats"
)

func main() {
	cfg := config.Load("analytics_exporter")

	nc, err := internalnats.Connect(cfg.NatsURL, cfg.ServiceName)
	if err != nil {
		log.Fatalf("nats connection failed: %v", err)
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("jetstream init failed: %v", err)
	}

	_, err = js.Subscribe(events.SubjectAnalyticsEvents, func(msg *nats.Msg) {
		log.Printf("analytics exporter received event: %d bytes", len(msg.Data))
		msg.Ack()
	}, nats.ManualAck())
	if err != nil {
		log.Fatalf("subscribe failed: %v", err)
	}

	log.Printf("analytics exporter listening on %s", events.SubjectAnalyticsEvents)
	for {
		time.Sleep(10 * time.Second)
	}
}
