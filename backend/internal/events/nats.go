package events

import (
	"context"
	"encoding/json"
	"time"

	"github.com/nats-io/nats.go"
)

const (
	AnalysisStreamName  = "ANALYSIS"
	AnalysisSubject     = "analysis.*"
	AnalysisJobsSubject = "analysis.jobs"
)

type Publisher struct {
	nc *nats.Conn
	js nats.JetStreamContext
}

func NewPublisher(url string) (*Publisher, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, err
	}
	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, err
	}
	_, err = js.AddStream(&nats.StreamConfig{
		Name:      AnalysisStreamName,
		Subjects:  []string{AnalysisSubject},
		Retention: nats.LimitsPolicy,
		MaxAge:    7 * 24 * time.Hour,
	})
	if err != nil && err != nats.ErrStreamNameAlreadyInUse {
		nc.Close()
		return nil, err
	}
	return &Publisher{nc: nc, js: js}, nil
}

func (p *Publisher) Close() {
	if p == nil || p.nc == nil {
		return
	}
	p.nc.Close()
}

func (p *Publisher) PublishJSON(ctx context.Context, subject string, payload any) error {
	if p == nil || p.js == nil {
		return nil
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = p.js.Publish(subject, data, nats.Context(ctx))
	return err
}

func (p *Publisher) JetStream() nats.JetStreamContext {
	return p.js
}
