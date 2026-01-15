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
	cfg := config.Load("normalize")

	nc, err := internalnats.Connect(cfg.NatsURL, cfg.ServiceName)
	if err != nil {
		log.Fatalf("nats connection failed: %v", err)
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("jetstream init failed: %v", err)
	}

	_, err = js.Subscribe(events.SubjectScansUploaded, func(msg *nats.Msg) {
		log.Printf("normalize received scan: %d bytes", len(msg.Data))
		if _, err := js.Publish(events.SubjectFindingsNormalized, msg.Data); err != nil {
			log.Printf("publish normalized failed: %v", err)
		}
		msg.Ack()
	}, nats.ManualAck())
	if err != nil {
		log.Fatalf("subscribe failed: %v", err)
	}

	log.Printf("normalize listening on %s", events.SubjectScansUploaded)
	for {
		time.Sleep(10 * time.Second)
	}
}
