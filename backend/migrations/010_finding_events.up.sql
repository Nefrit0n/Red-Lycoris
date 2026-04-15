CREATE TABLE finding_events (
    id UUID PRIMARY KEY,
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finding_events_finding_created_desc
    ON finding_events (finding_id, created_at DESC);

CREATE INDEX idx_finding_events_user_created_desc
    ON finding_events (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX idx_finding_events_seen_again_unique_per_day
    ON finding_events (finding_id, (created_at::date))
    WHERE event_type = 'seen_again';
