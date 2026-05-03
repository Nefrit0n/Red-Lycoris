import { apiDelete, apiGet, apiPost, apiPatch } from "@/api/client";

export interface RoleRef {
  key: "admin" | "auditor" | "member" | "viewer";
  name: string;
}

export interface GroupRef {
  id: string;
  name: string;
  color_key: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  color_key: string;
  description?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  status: "active" | "pending" | "disabled";
  is_system_account: boolean;
  role: RoleRef;
  groups: GroupRef[];
  mfa_enabled: boolean;
  identity_kind: "local" | "ldap" | "ad" | "oidc";
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  must_change_password: boolean;
}

export interface AdminUsersListMeta {
  total: number;
  has_more: boolean;
  next_cursor: string | null;
}

export interface AdminUsersListResponse {
  data: AdminUser[];
  meta: AdminUsersListMeta;
}

export interface UserListParams {
  q?: string;
  role?: string;
  status?: string;
  group?: string;
  mfa?: "enabled" | "disabled";
  source?: string;
  dormant?: boolean;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export interface CreateUserPayload {
  email: string;
  display_name: string;
  password: string;
  role_key: "admin" | "auditor" | "member" | "viewer";
  group_ids: string[];
  send_credentials_email: boolean;
}

export interface BulkActionResult {
  user_id: string;
  success: boolean;
  error?: string;
}

export interface AccessCounts {
  users: number;
  groups: number;
  roles: number;
}

function buildUserParams(params: UserListParams): URLSearchParams {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.role) p.set("role", params.role);
  if (params.status) p.set("status", params.status);
  if (params.group) p.set("group", params.group);
  if (params.mfa) p.set("mfa", params.mfa);
  if (params.source) p.set("source", params.source);
  if (params.dormant) p.set("dormant", "true");
  if (params.sort) p.set("sort", params.sort);
  if (params.cursor) p.set("cursor", params.cursor);
  if (params.limit) p.set("limit", String(params.limit));
  return p;
}

export async function fetchAdminUsers(
  params: UserListParams
): Promise<AdminUsersListResponse> {
  const qs = buildUserParams(params).toString();
  return apiGet<AdminUsersListResponse>(`/api/v1/admin/users${qs ? "?" + qs : ""}`);
}

export async function fetchAdminUser(id: string): Promise<{ data: AdminUser }> {
  return apiGet<{ data: AdminUser }>(`/api/v1/admin/users/${id}`);
}

export async function checkEmailAvailable(
  email: string
): Promise<{ data: { available: boolean } }> {
  const p = new URLSearchParams({ email });
  return apiGet<{ data: { available: boolean } }>(
    `/api/v1/admin/users/check-email?${p}`
  );
}

export async function createAdminUser(
  payload: CreateUserPayload
): Promise<{ data: AdminUser }> {
  return apiPost<{ data: AdminUser }>("/api/v1/admin/users", payload);
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
  reason: string
): Promise<void> {
  await apiPost(`/api/v1/admin/users/${id}/reset-password`, {
    new_password: newPassword,
    reason,
  });
}

export async function deactivateUser(
  id: string,
  reason: string
): Promise<void> {
  await apiPost(`/api/v1/admin/users/${id}/deactivate`, { reason });
}

export async function activateUser(id: string): Promise<void> {
  await apiPost(`/api/v1/admin/users/${id}/activate`, {});
}

export async function deleteUser(id: string, reason: string): Promise<void> {
  await apiDelete(`/api/v1/admin/users/${id}`, { reason });
}

export async function terminateUserSessions(
  id: string,
  reason: string
): Promise<void> {
  await apiPost(`/api/v1/admin/users/${id}/deactivate`, { reason });
}

export async function bulkDeactivateUsers(
  userIds: string[],
  reason: string
): Promise<{ data: BulkActionResult[] }> {
  return apiPost<{ data: BulkActionResult[] }>(
    "/api/v1/admin/users/bulk-deactivate",
    { user_ids: userIds, reason }
  );
}

export async function bulkResetPasswords(
  userIds: string[],
  newPassword: string,
  reason: string
): Promise<{ data: BulkActionResult[] }> {
  return apiPost<{ data: BulkActionResult[] }>(
    "/api/v1/admin/users/bulk-reset-password",
    { user_ids: userIds, new_password: newPassword, reason }
  );
}

export function exportUsersCSVUrl(params: UserListParams): string {
  const qs = buildUserParams(params).toString();
  return `/api/v1/admin/users/export.csv${qs ? "?" + qs : ""}`;
}

export async function fetchGroups(
  q?: string,
  limit?: number
): Promise<{ data: GroupSummary[] }> {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (limit) p.set("limit", String(limit));
  return apiGet<{ data: GroupSummary[] }>(
    `/api/v1/admin/groups${p.toString() ? "?" + p : ""}`
  );
}

export async function fetchAccessCounts(): Promise<{ data: AccessCounts }> {
  return apiGet<{ data: AccessCounts }>("/api/v1/admin/access/counts");
}

export async function changeUserRole(
  id: string,
  isAdmin: boolean,
  reason?: string
): Promise<{ data: AdminUser }> {
  return apiPatch<{ data: AdminUser }>(`/api/v1/admin/users/${id}/role`, {
    is_admin: isAdmin,
    reason: reason ?? "",
  });
}

/** Checks if a password appears in the HIBP pwned passwords database. */
export async function checkPasswordHIBP(
  password: string
): Promise<{ pwned: boolean; unavailable: boolean }> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      { headers: { "Add-Padding": "true" } }
    );
    if (!res.ok) {
      return { pwned: false, unavailable: true };
    }
    const text = await res.text();
    const pwned = text
      .split("\n")
      .some((line) => line.toUpperCase().startsWith(suffix));
    return { pwned, unavailable: false };
  } catch {
    return { pwned: false, unavailable: true };
  }
}
