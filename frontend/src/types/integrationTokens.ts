export type IntegrationTokenScope =
  | "ingest:run:init"
  | "ingest:artifact:write"
  | "ingest:run:commit"
  | "admin:tokens:read"
  | "admin:tokens:write";

export interface IntegrationToken {
  id: string;
  name: string;
  revision: number;
  tenant: { org_id: string; project_id?: string };
  scopes: IntegrationTokenScope[];
  state: "ACTIVE" | "REVOKED" | "EXPIRED";
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  created_by?: string | { name?: string; email?: string; id?: string };
  updated_at?: string;
  revoked_at?: string;
}

export interface IntegrationTokenAuditEvent {
  id: string;
  token_id: string;
  action: "ISSUED" | "USED" | "PATCHED" | "ROTATED" | "REVOKED" | "DENIED";
  actor_type: "USER" | "TOKEN" | "SYSTEM";
  actor_id?: string;
  request_id?: string;
  ip?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
  occurred_at: string;
}
