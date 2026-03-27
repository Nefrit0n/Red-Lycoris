# Archived Migrations (001–050)

These are the original 50 incremental database migrations that were squashed into
a single `001_baseline.up.sql` file.

They are preserved here for historical reference only.
**Do NOT move them back into `backend/migrations/`.**

## What happened

- All 50 migrations were applied to a clean PostgreSQL 16 database.
- `pg_dump --schema-only` was used to capture the final schema state.
- The output was cleaned and saved as `backend/migrations/001_baseline.up.sql`.
- A noop `051_noop_after_squash` migration was added as a version sync point.
- New migrations should start from `052_*.sql`.
