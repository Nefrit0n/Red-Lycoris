# Known Issues

Tracked limitations and deferred work for upcoming milestones.

---

## [projects] Source/Invites fields silently dropped

**File:** `backend/internal/api/projects.go:99`

**Details:** `createProjectRequest` accepts `source` and `invites` JSON fields to stay
forward-compatible with richer wizard payloads from the frontend, but neither field is
processed or persisted. Both are silently ignored after decoding.
