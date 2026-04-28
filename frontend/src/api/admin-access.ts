import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/api/client";

export type AccessLevel = "read" | "write" | "admin";

export interface EffectiveAccessSource {
  kind: "role" | "group" | "user";
  id: string;
  name: string;
  color_key?: string;
  granted_level: AccessLevel;
}

export interface EffectiveProjectAccess {
  project_id: string;
  project_name: string;
  level: AccessLevel | null;
  sources: EffectiveAccessSource[];
  is_personal_override: boolean;
}

export interface AdminGroup {
  id: string;
  name: string;
  description: string;
  color_key: string;
  source: "manual" | "ldap_sync";
  members_count: number;
  projects_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface GroupMember {
  user_id: string;
  email: string;
  display_name: string;
  status: string;
  added_at: string;
}

export interface GroupProject {
  project_id: string;
  project_name: string;
  level: AccessLevel;
  granted_at: string;
}

export interface AdminRole {
  id: string;
  key: string;
  name: string;
  description: string;
  users_count: number;
  permissions: Array<{ key: string; resource: string; action: string; description: string }>;
}

export interface AdminUserSession {
  id: string;
  user_agent: string;
  ip: string;
  issued_at: string;
  last_active: string;
  expires_at: string;
}

export const fetchUserEffectiveProjects = (userId: string) => apiGet<{ data: EffectiveProjectAccess[] }>(`/api/v1/admin/users/${userId}/projects`);
export const putUserProjectOverride = (userId: string, projectId: string, level: AccessLevel) => apiPut(`/api/v1/admin/users/${userId}/projects/${projectId}`, { level });
export const deleteUserProjectOverride = (userId: string, projectId: string) => apiDelete(`/api/v1/admin/users/${userId}/projects/${projectId}`);
export const fetchUserSessions = (userId: string) => apiGet<{ data: AdminUserSession[] }>(`/api/v1/admin/users/${userId}/sessions`);
export const revokeUserSession = (userId: string, sessionId: string) => apiDelete(`/api/v1/admin/users/${userId}/sessions/${sessionId}`);
export const revokeAllUserSessions = (userId: string) => apiPost(`/api/v1/admin/users/${userId}/sessions/revoke-all`, {});

export const fetchGroupsAdmin = (q?: string) => apiGet<{ data: AdminGroup[] }>(`/api/v1/admin/groups${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const createGroup = (payload: { name: string; description: string; color_key: string }) => apiPost<{ data: AdminGroup }>("/api/v1/admin/groups", payload);
export const fetchGroup = (id: string) => apiGet<{ data: AdminGroup }>(`/api/v1/admin/groups/${id}`);
export const patchGroup = (id: string, payload: { name: string; description: string; color_key: string }) => apiPatch(`/api/v1/admin/groups/${id}`, payload);
export const deleteGroup = (id: string) => apiDelete(`/api/v1/admin/groups/${id}`);
export const fetchGroupMembers = (id: string) => apiGet<{ data: GroupMember[] }>(`/api/v1/admin/groups/${id}/members`);
export const addGroupMembers = (id: string, user_ids: string[]) => apiPost(`/api/v1/admin/groups/${id}/members`, { user_ids });
export const removeGroupMember = (id: string, uid: string) => apiDelete(`/api/v1/admin/groups/${id}/members/${uid}`);
export const fetchGroupProjects = (id: string) => apiGet<{ data: GroupProject[] }>(`/api/v1/admin/groups/${id}/projects`);
export const putGroupProject = (id: string, pid: string, level: AccessLevel) => apiPut(`/api/v1/admin/groups/${id}/projects/${pid}`, { level });
export const deleteGroupProject = (id: string, pid: string) => apiDelete(`/api/v1/admin/groups/${id}/projects/${pid}`);

export const fetchRoles = () => apiGet<{ data: AdminRole[] }>("/api/v1/admin/roles");
export const fetchRole = (id: string) => apiGet<{ data: AdminRole }>(`/api/v1/admin/roles/${id}`);
export const searchAssignableUsers = (q: string) => apiGet<{ data: Array<{ id: string; email: string; full_name: string }> }>(`/api/v1/users/search?q=${encodeURIComponent(q)}`);
