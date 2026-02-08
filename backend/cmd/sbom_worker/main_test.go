package main

import (
	"context"
	"testing"

	"github.com/nats-io/nats.go"
)

func TestHandleMessageInvalidPayload(t *testing.T) {
	msg := &nats.Msg{Data: []byte("not-json")}
	if err := handleMessage(context.Background(), msg, nil, nil); err == nil {
		t.Fatal("expected error for invalid json")
	}
}

func TestHandleMessageInvalidUUID(t *testing.T) {
	msg := &nats.Msg{Data: []byte(`{"sbom_id":"not-a-uuid","product_id":"p","object_key":"k","format":"cyclonedx","sha256":"x"}`)}
	if err := handleMessage(context.Background(), msg, nil, nil); err == nil {
		t.Fatal("expected error for invalid uuid")
	}
}
