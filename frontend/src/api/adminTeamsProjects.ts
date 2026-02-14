import { request } from "./client";

const idem = () => ({ "Idempotency-Key": crypto.randomUUID() });

export const listTeams = (query: Record<string, string | number | undefined>) =>
  request<{ items: Array<{ id: string; name: string; members_count: number; products_count: number; updated_at: string }>; next_cursor: string | null }>("/api/v1/admin/teams", { query });

export const createTeam = (payload: { name: string; description?: string }) =>
  request<{ id: string }>("/api/v1/admin/teams", { method: "POST", body: payload, headers: idem() });

export const patchTeam = (teamId: string, payload: { name?: string; description?: string }) =>
  request<{ ok: boolean }>(`/api/v1/admin/teams/${teamId}`, { method: "PATCH", body: payload, headers: idem() });

export const getTeam = (teamId: string) =>
  request<{ id: string; name: string; description: string | null; members: Array<{ user_id: string; email: string; full_name: string | null }>; product_roles: Array<{ product_id: string; product_name: string; role: string }> }>(`/api/v1/admin/teams/${teamId}`);

export const putTeamMembers = (teamId: string, userIds: string[]) =>
  request<{ ok: boolean }>(`/api/v1/admin/teams/${teamId}/members`, { method: "PUT", body: { user_ids: userIds }, headers: idem() });

export const listAdminProducts = () => request<Array<{ id: string; name: string }>>("/api/v1/admin/products");

export const getProductAccess = (productId: string) =>
  request<{ teams: Array<{ team_id: string; team_name: string; role: string }>; users: Array<{ user_id: string; email: string; full_name: string | null; role: string }> }>(`/api/v1/admin/products/${productId}/access`);

export const putProductTeamRole = (productId: string, teamId: string, role: string) =>
  request<{ ok: boolean }>(`/api/v1/admin/products/${productId}/teams/${teamId}/role`, { method: "PUT", body: { role }, headers: idem() });

export const deleteProductTeamRole = (productId: string, teamId: string) =>
  request<{ ok: boolean }>(`/api/v1/admin/products/${productId}/teams/${teamId}/role`, { method: "DELETE", headers: idem() });

export const putProductUserRole = (productId: string, userId: string, role: string) =>
  request<{ ok: boolean }>(`/api/v1/admin/products/${productId}/users/${userId}/role`, { method: "PUT", body: { role }, headers: idem() });

export const deleteProductUserRole = (productId: string, userId: string) =>
  request<{ ok: boolean }>(`/api/v1/admin/products/${productId}/users/${userId}/role`, { method: "DELETE", headers: idem() });

export const getEffectiveAccess = (productId: string, userId: string) =>
  request<{ effective_role: string; sources: Array<{ type: string; role: string; detail: string; team_id?: string; team_name?: string }> }>(`/api/v1/admin/products/${productId}/effective-access/${userId}`);
