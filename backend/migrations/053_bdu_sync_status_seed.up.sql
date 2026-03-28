-- Ensure singleton row for BDU sync status exists after migration squash.
INSERT INTO public.bdu_sync_status (id, sync_interval_hours, record_count, is_syncing, updated_at)
VALUES (1, 24, 0, FALSE, NOW())
ON CONFLICT (id) DO NOTHING;
