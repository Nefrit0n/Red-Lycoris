import { request } from "./client";

export interface BduSyncStatus {
  last_synced_at: string | null;
  record_count: number;
  sync_interval_hours: number;
  last_error: string | null;
  is_syncing: boolean;
  updated_at: string;
}

export const getBduSyncStatus = () => request<BduSyncStatus>("/api/v1/admin/bdu/sync-status");

export const updateBduSyncInterval = (intervalHours: number) =>
  request<{ interval_hours: number }>("/api/v1/admin/bdu/sync-interval", {
    method: "PUT",
    body: { interval_hours: intervalHours },
  });
