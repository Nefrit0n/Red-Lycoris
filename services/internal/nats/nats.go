package nats

import (
	"time"

	"github.com/nats-io/nats.go"
)

func Connect(url string, name string) (*nats.Conn, error) {
	return nats.Connect(
		url,
		nats.Name(name),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
	)
}
