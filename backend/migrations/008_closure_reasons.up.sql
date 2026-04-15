CREATE TABLE closure_reasons (
    id SMALLSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    target_status SMALLINT NOT NULL,
    requires_note BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO closure_reasons (id, code, label, target_status, requires_note, is_active)
VALUES
    (1, 'false_positive', 'False Positive', 2, false, true),
    (2, 'acceptable_risk', 'Acceptable Risk', 4, true, true),
    (3, 'mitigated', 'Mitigated', 3, false, true),
    (4, 'duplicate', 'Duplicate', 3, false, true),
    (5, 'not_applicable', 'Not Applicable', 2, true, true);
