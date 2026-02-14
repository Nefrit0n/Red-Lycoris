import { request } from "./client";

export interface AdminUserItem {
  id: string;
  full_name: string;
  email: string;
  org_role: "owner" | "admin" | "security_manager" | "viewer";
  status: "active" | "deactivated" | "invited";
  last_login_at: string | null;
  teams_count: number;
  products_count: number;
}

export interface AdminUsersListResponse {
  items: AdminUserItem[];
  next_cursor: string | null;
}

export interface AdminUserAccessResponse {
  org_role: string;
  teams: Array<{ id: string; name: string }>;
  product_roles: Array<{ product_id: string; product_name: string; role: string }>;
}

const idempotencyHeaders = () => ({
  "Idempotency-Key": crypto.randomUUID(),
});

export const listAdminUsers = (query: Record<string, string | number | undefined>) =>
  request<AdminUsersListResponse>("/api/v1/admin/users", { query });

export const inviteAdminUser = (payload: { email: string; full_name?: string; org_role: string }) =>
  request<{ invitation_id: string; status: string }>("/api/v1/admin/users/invite", {
    method: "POST",
    body: payload,
    headers: idempotencyHeaders(),
  });

export const patchAdminUser = (userId: string, payload: { org_role?: string; status?: string }) =>
  request<{ ok: boolean }>(`/api/v1/admin/users/${userId}`, {
    method: "PATCH",
    body: payload,
    headers: idempotencyHeaders(),
  });

export const getAdminUserAccess = (userId: string) =>
  request<AdminUserAccessResponse>(`/api/v1/admin/users/${userId}/access`);

export const putAdminUserTeams = (userId: string, teamIds: string[]) =>
  request<{ ok: boolean }>(`/api/v1/admin/users/${userId}/teams`, {
    method: "PUT",
    body: { team_ids: teamIds },
    headers: idempotencyHeaders(),
  });

export const setAdminUserProductRole = (userId: string, productId: string, role: string) =>
  request<{ ok: boolean }>(`/api/v1/admin/users/${userId}/products/${productId}/role`, {
    method: "PUT",
    body: { role },
    headers: idempotencyHeaders(),
  });

export const deleteAdminUserProductRole = (userId: string, productId: string) =>
  request<{ ok: boolean }>(`/api/v1/admin/users/${userId}/products/${productId}/role`, {
    method: "DELETE",
    headers: idempotencyHeaders(),
  });

export const bulkAdminUsers = (payload: { user_ids: string[]; action: string; params: Record<string, unknown> }) =>
  request<{ ok: boolean; processed: number }>("/api/v1/admin/users/bulk", {
    method: "POST",
    body: payload,
    headers: idempotencyHeaders(),
  });
