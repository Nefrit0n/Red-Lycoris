import { request } from "./client";
import type { IntegrationToken, IntegrationTokenAuditEvent, IntegrationTokenScope } from "../types/integrationTokens";

const idempotencyHeaders = () => ({ "Idempotency-Key": crypto.randomUUID() });

export interface ListIntegrationTokensQuery {
  org_id: string;
  project_id?: string;
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}

const pickProjectID = (value: unknown): string | undefined => {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object") {
    const obj = value as { String?: unknown; Valid?: unknown };
    if (obj.Valid === true && typeof obj.String === "string" && obj.String) {
      return obj.String;
    }
  }
  return undefined;
};

const normalizeToken = (raw: any): IntegrationToken => {
  const id = raw?.id ?? raw?.ID ?? "";
  const orgID = raw?.tenant?.org_id ?? raw?.org_id ?? raw?.OrgID ?? "";
  const projectID = raw?.tenant?.project_id ?? raw?.project_id ?? pickProjectID(raw?.ProjectID);
  const expiresAt = raw?.expires_at ?? raw?.ExpiresAt;
  const revokedAt = raw?.revoked_at ?? raw?.RevokedAt;
  const derivedState = revokedAt
    ? "REVOKED"
    : expiresAt && new Date(expiresAt).getTime() <= Date.now()
      ? "EXPIRED"
      : "ACTIVE";

  return {
    id,
    name: raw?.name ?? raw?.Name ?? "",
    revision: raw?.revision ?? raw?.Revision ?? 1,
    tenant: { org_id: orgID, project_id: projectID },
    scopes: raw?.scopes ?? raw?.Scopes ?? [],
    state: raw?.state ?? raw?.State ?? derivedState,
    expires_at: expiresAt,
    last_used_at: raw?.last_used_at ?? raw?.LastUsedAt,
    created_at: raw?.created_at ?? raw?.CreatedAt,
    created_by: raw?.created_by ?? raw?.createdBy ?? raw?.CreatedBy ?? raw?.CreatedByUser ?? raw?.CreatedByUserID,
    updated_at: raw?.updated_at ?? raw?.UpdatedAt,
    revoked_at: revokedAt,
  };
};

const normalizeAuditEvent = (raw: any): IntegrationTokenAuditEvent => ({
  id: String(raw?.id ?? raw?.ID ?? ""),
  token_id: raw?.token_id ?? raw?.tokenID ?? raw?.tokenId ?? "",
  action: raw?.action ?? raw?.event_type ?? "DENIED",
  actor_type: raw?.actor_type ?? "SYSTEM",
  actor_id: raw?.actor_id,
  request_id: raw?.request_id,
  ip: raw?.ip,
  user_agent: raw?.user_agent,
  details: raw?.details,
  occurred_at: raw?.occurred_at ?? raw?.at ?? new Date(0).toISOString(),
});

export const listIntegrationTokens = (query: ListIntegrationTokensQuery) =>
  request<{ items: any[]; total?: number }>("/api/v1/admin/integration-tokens", { query }).then((response) => ({
    items: (response.items ?? []).map(normalizeToken),
    total: response.total,
  }));

export const createIntegrationToken = (payload: {
  name: string;
  tenant: { org_id: string; project_id?: string };
  scopes: IntegrationTokenScope[];
  expires_at?: string;
}) =>
  request<{ token: IntegrationToken; token_secret: string }>("/api/v1/admin/integration-tokens", {
    method: "POST",
    body: payload,
    headers: idempotencyHeaders(),
  });

export const patchIntegrationToken = (id: string, payload: { name?: string; expires_at?: string }) =>
  request<IntegrationToken>(`/api/v1/admin/integration-tokens/${id}`, {
    method: "PATCH",
    body: payload,
    headers: idempotencyHeaders(),
  }).then(normalizeToken);

export const revokeIntegrationToken = (id: string) =>
  request<IntegrationToken>(`/api/v1/admin/integration-tokens/${id}/revoke`, {
    method: "POST",
    headers: idempotencyHeaders(),
  }).then(normalizeToken);

export const rotateIntegrationToken = (id: string) =>
  request<{ token: any; token_secret: string }>(`/api/v1/admin/integration-tokens/${id}/rotate`, {
    method: "POST",
    headers: idempotencyHeaders(),
  }).then((response) => ({ ...response, token: normalizeToken(response.token) }));

export const getIntegrationTokenAudit = (id: string, query?: { cursor?: string; limit?: number }) =>
  request<{ items: any[]; next_cursor?: string }>(`/api/v1/admin/integration-tokens/${id}/audit`, {
    query,
  }).then((response) => ({
    items: (response.items ?? []).map(normalizeAuditEvent),
    next_cursor: response.next_cursor,
  }));
