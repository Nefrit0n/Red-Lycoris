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
	cfg := config.Load("enrich")

	nc, err := internalnats.Connect(cfg.NatsURL, cfg.ServiceName)
	if err != nil {
		log.Fatalf("nats connection failed: %v", err)
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("jetstream init failed: %v", err)
	}

	_, err = js.Subscribe(events.SubjectFindingsDeduped, func(msg *nats.Msg) {
		log.Printf("enrich received deduped findings: %d bytes", len(msg.Data))
		if _, err := js.Publish(events.SubjectFindingsEnriched, msg.Data); err != nil {
			log.Printf("publish enriched failed: %v", err)
		}
		msg.Ack()
	}, nats.ManualAck())
	if err != nil {
		log.Fatalf("subscribe failed: %v", err)
	}

	log.Printf("enrich listening on %s", events.SubjectFindingsDeduped)
	for {
		time.Sleep(10 * time.Second)
	}
}
