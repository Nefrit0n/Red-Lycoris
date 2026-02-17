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

export const listIntegrationTokens = (query: ListIntegrationTokensQuery) =>
  request<{ items: IntegrationToken[]; total?: number }>("/api/v1/admin/integration-tokens", { query });

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
  });

export const revokeIntegrationToken = (id: string) =>
  request<IntegrationToken>(`/api/v1/admin/integration-tokens/${id}/revoke`, {
    method: "POST",
    headers: idempotencyHeaders(),
  });

export const rotateIntegrationToken = (id: string) =>
  request<{ token: IntegrationToken; token_secret: string }>(`/api/v1/admin/integration-tokens/${id}/rotate`, {
    method: "POST",
    headers: idempotencyHeaders(),
  });

export const getIntegrationTokenAudit = (id: string, query?: { cursor?: string; limit?: number }) =>
  request<{ items: IntegrationTokenAuditEvent[]; next_cursor?: string }>(`/api/v1/admin/integration-tokens/${id}/audit`, {
    query,
  });
