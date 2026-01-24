package events

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/nats-io/nats.go"
)

const (
	AnalysisStreamName  = "ANALYSIS"
	AnalysisSubject     = "analysis.>"
	AnalysisJobsSubject = "analysis.jobs"

	SbomStreamName            = "SBOM"
	SbomSubject               = "sbom.>"
	SbomIndexRequestedSubject = "sbom.index.requested.v1"

	RiskRecomputeRequestedSubject = "finding.risk.recompute.requested.v1"
)

type Publisher struct {
	nc *nats.Conn
	js nats.JetStreamContext
}

func NewPublisher(url string) (*Publisher, error) {
	nc, err := nats.Connect(
		url,
		nats.Name("lotus-warden"),
		nats.Timeout(5*time.Second),
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(1*time.Second),
	)
	if err != nil {
		return nil, err
	}

	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, err
	}

	// Важно: не просто AddStream. Если stream уже есть, но subjects другие — делаем UpdateStream.
	if err := ensureStream(js, &nats.StreamConfig{
		Name:      AnalysisStreamName,
		Subjects:  []string{AnalysisSubject, RiskRecomputeRequestedSubject, AssetContextUpdatedSubject, RiskModelActivatedSubject},
		Retention: nats.LimitsPolicy,
		MaxAge:    7 * 24 * time.Hour,
	}); err != nil {
		nc.Close()
		return nil, fmt.Errorf("ensure stream %s failed: %w", AnalysisStreamName, err)
	}

	if err := ensureStream(js, &nats.StreamConfig{
		Name:      IntelStreamName,
		Subjects:  []string{IntelSubject},
		Retention: nats.LimitsPolicy,
		MaxAge:    7 * 24 * time.Hour,
	}); err != nil {
		nc.Close()
		return nil, fmt.Errorf("ensure stream %s failed: %w", IntelStreamName, err)
	}

	if err := ensureStream(js, &nats.StreamConfig{
		Name:      SbomStreamName,
		Subjects:  []string{SbomSubject},
		Retention: nats.LimitsPolicy,
		MaxAge:    7 * 24 * time.Hour,
	}); err != nil {
		nc.Close()
		return nil, fmt.Errorf("ensure stream %s failed: %w", SbomStreamName, err)
	}

	return &Publisher{nc: nc, js: js}, nil
}

func ensureStream(js nats.JetStreamContext, desired *nats.StreamConfig) error {
	info, err := js.StreamInfo(desired.Name)
	if err != nil {
		if err == nats.ErrStreamNotFound {
			_, err := js.AddStream(desired)
			return err
		}
		return err
	}

	// Stream существует — проверяем, совпадает ли важная конфигурация.
	current := info.Config
	if sameStringSet(current.Subjects, desired.Subjects) &&
		current.Retention == desired.Retention &&
		current.MaxAge == desired.MaxAge {
		return nil
	}

	_, err = js.UpdateStream(desired)
	return err
}

func sameStringSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	aa := append([]string(nil), a...)
	bb := append([]string(nil), b...)
	sort.Strings(aa)
	sort.Strings(bb)
	for i := range aa {
		if aa[i] != bb[i] {
			return false
		}
	}
	return true
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

func (p *Publisher) PublishJSONWithMsgID(ctx context.Context, subject string, msgID string, payload any) error {
	if p == nil || p.js == nil {
		return nil
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	msg := nats.NewMsg(subject)
	msg.Data = data
	if msg.Header == nil {
		msg.Header = nats.Header{}
	}
	msg.Header.Set(nats.MsgIdHdr, msgID)
	_, err = p.js.PublishMsg(msg, nats.Context(ctx))
	return err
}

func (p *Publisher) JetStream() nats.JetStreamContext { return p.js }
