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
	cfg := config.Load("dedup")

	nc, err := internalnats.Connect(cfg.NatsURL, cfg.ServiceName)
	if err != nil {
		log.Fatalf("nats connection failed: %v", err)
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("jetstream init failed: %v", err)
	}

	_, err = js.Subscribe(events.SubjectFindingsNormalized, func(msg *nats.Msg) {
		log.Printf("dedup received normalized findings: %d bytes", len(msg.Data))
		if _, err := js.Publish(events.SubjectFindingsDeduped, msg.Data); err != nil {
			log.Printf("publish deduped failed: %v", err)
		}
		msg.Ack()
	}, nats.ManualAck())
	if err != nil {
		log.Fatalf("subscribe failed: %v", err)
	}

	log.Printf("dedup listening on %s", events.SubjectFindingsNormalized)
	for {
		time.Sleep(10 * time.Second)
	}
}
